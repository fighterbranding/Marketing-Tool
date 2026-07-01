# Business Manager API

## Overview

Handles discovering and linking a client's Business Manager, its ad accounts, and the permission relationships between them. This is what powers the System User token approach mentioned in [auth-service.md](../02-backend/auth-service.md).

## Implementation

### 1. Listing ad accounts under a Business

```typescript
async getAdAccounts(businessId: string, token: string) {
  const res = await axios.get(`https://graph.facebook.com/${version}/${businessId}/owned_ad_accounts`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { fields: 'id,name,account_status,currency,timezone_name' },
  });
  return res.data.data;
}
```

`account_status` matters — a value other than `1` (active) means the ad account is disabled, pending review, or has a payment issue. Surface this clearly rather than letting subsequent insights/campaign calls fail confusingly.

### 2. System User setup (client-side steps to document for clients)

This isn't an API call you make — it's a manual flow the client does in their Business Manager settings, which you should document for them in your onboarding flow:

1. Client goes to Business Settings → System Users → adds a new System User
2. Assigns your app and the relevant ad account(s)/page(s) with the appropriate role
3. Generates a System User access token, scoped to your app, and provides it to you

```typescript
// You receive this token via a settings form, not an OAuth redirect
async connectSystemUser(clientId: string, systemUserToken: string) {
  // verify the token is valid and scoped correctly before storing
  const debug = await axios.get(`https://graph.facebook.com/${version}/debug_token`, {
    params: { input_token: systemUserToken, access_token: `${appId}|${appSecret}` },
  });
  if (!debug.data.data.is_valid) throw new Error('Invalid system user token');

  await this.storeEncryptedToken(clientId, systemUserToken, 'system_user');
}
```

System User tokens don't expire on the same 60-day cycle as personal tokens — they're valid until explicitly revoked, which is the stability win for a SaaS platform serving many clients long-term.

### 3. Verifying permission grants before making calls

Before attempting an insights or campaign call, check that the token actually has access to the specific ad account ID you're about to query — avoids a wall of opaque 200-permission-error responses for accounts the client didn't grant.

```typescript
async verifyAccess(adAccountId: string, token: string): Promise<boolean> {
  try {
    await axios.get(`https://graph.facebook.com/${version}/act_${adAccountId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'id' },
    });
    return true;
  } catch {
    return false;
  }
}
```

## Required scope

`business_management`

## Estimated time

3-5 days, plus writing the client-facing documentation/UI for the System User setup flow (this is as much a UX problem as a code problem — walking a non-technical client through Business Manager settings needs clear screenshots/copy).
