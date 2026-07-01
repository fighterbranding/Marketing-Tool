# Auth service

## Overview

Handles the full Meta OAuth lifecycle: redirecting the client to Meta's consent screen, exchanging the returned code for tokens, encrypting and storing those tokens, and refreshing them before expiry. Every other backend module depends on this — nothing can call the Meta API without a valid token from here.

## Decisions to make before building

**User-level vs System User tokens.** Two ways a client connects their Meta account:

- *User-level* — client logs in with their personal Facebook login, you get a token scoped to whatever ad accounts/pages they personally administer. Simpler to implement, but the token is tied to that person — if they leave the client's company or change their password, the connection can break.
- *System User* (via Meta Business Manager) — client adds your app as a System User in their Business Manager, you get a token that isn't tied to an individual. More setup friction for the client (they need Business Manager admin access), but far more stable for a multi-client SaaS product.

**Recommendation for this project:** support user-level login for the initial "connect" flow (lowest friction for onboarding), but prompt clients to additionally set up System User access once they're using the product seriously. Document this as a manual settings page item rather than blocking the first connection on it.

## Implementation steps

### 1. Meta App Dashboard setup

- Add the "Facebook Login for Business" product
- Set OAuth redirect URI to `https://yourapp.com/auth/meta/callback` (must match exactly what you send in the auth request)
- Note App ID and App Secret into `.env`

### 2. Build the redirect endpoint

```typescript
// auth.controller.ts
@Get('meta/connect')
connectMeta(@Res() res: Response) {
  const scopes = [
    'ads_management',
    'ads_read',
    'business_management',
    'pages_show_list',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_manage_insights',
  ].join(',');

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', process.env.META_REDIRECT_URI);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', generateAndStoreCsrfToken()); // CSRF protection

  res.redirect(url.toString());
}
```

Only request scopes you actually use in the MVP. Adding unused scopes is the most common reason App Review gets rejected or delayed — Meta reviewers test that each requested permission is visibly used in the product.

### 3. Handle the callback (short-lived code → short-lived token)

```typescript
@Get('meta/callback')
async handleCallback(@Query('code') code: string, @Query('state') state: string) {
  verifyCsrfToken(state);

  const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    },
  });

  const shortLivedToken = tokenRes.data.access_token;
  // proceed to step 4 immediately — short-lived tokens last ~1-2 hours
}
```

### 4. Exchange for a long-lived token

This is the step that's easy to skip and causes integrations to silently break after an hour.

```typescript
async exchangeForLongLivedToken(shortLivedToken: string) {
  const res = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });
  return res.data.access_token; // valid ~60 days
}
```

### 5. Encrypt and store

Never store tokens in plaintext. Use AES-256-GCM with a key from `.env` (`TOKEN_ENCRYPTION_KEY`, generate with `openssl rand -hex 32`).

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptToken(token: string, key: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}
```

Store the result in the `meta_connections` table (see [primary-db.md](../04-storage/primary-db.md)), linked to the client record. After storing the token, immediately call the Business Manager API to discover which ad accounts, pages, and IG accounts the token has access to, and store those references too — you'll need them for every subsequent API call.

### 6. Token refresh

Long-lived tokens last ~60 days and Meta allows re-exchanging them for a fresh 60-day token at any point before expiry (you cannot refresh after expiry — the client has to reconnect). Build a scheduled job (in the [sync-engine](sync-engine.md)) that:

- Runs daily
- Finds tokens expiring within 7 days
- Calls the same exchange endpoint from step 4 with the current token
- Updates the stored encrypted token

### 7. Handle reconnection / revocation

Clients can revoke your app's access at any time from their Facebook settings. Your sync jobs will start getting 401/190 error codes from Meta when this happens. Catch this specifically and mark the connection as `needs_reconnect` in your DB rather than retrying blindly — surface this in the frontend so the client knows to reconnect.

## Testing this module

- Use a test Business Manager + test ad account (create one in Business Manager settings) so you're not testing against real client data
- Use the Access Token Debugger (developers.facebook.com/tools/debug/accesstoken) to verify token scopes and expiry match what you expect after each step
- Write an integration test that mocks the Meta token endpoints rather than hitting the real API in CI

## Estimated time

3-5 days for a clean implementation, plus iteration time if App Review sends back permission rejections (budget another few days for that round trip).
