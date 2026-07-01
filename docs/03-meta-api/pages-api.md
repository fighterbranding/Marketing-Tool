# Pages API

## Overview

Covers Facebook Page data and Instagram Business account data (Instagram is accessed through a Page it's linked to, not independently). WhatsApp Business profile basics also surface here; messaging itself uses the separate WhatsApp Cloud API endpoints (see note in [SKILLS.md](../SKILLS.md)).

## Implementation

### 1. Listing pages the connected account manages

```typescript
async getPages(token: string) {
  const res = await axios.get(`https://graph.facebook.com/${version}/me/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { fields: 'id,name,access_token,instagram_business_account' },
  });
  return res.data.data;
}
```

Important detail: each Page returned here has its **own access token**, separate from the user's token. You need to store this Page-level token to make Page-specific calls (posting, reading insights) — using the user token for these will fail or behave inconsistently.

### 2. Getting the linked Instagram Business account

```typescript
async getInstagramAccount(pageId: string, pageToken: string) {
  const res = await axios.get(`https://graph.facebook.com/${version}/${pageId}`, {
    headers: { Authorization: `Bearer ${pageToken}` },
    params: { fields: 'instagram_business_account{id,username,profile_picture_url}' },
  });
  return res.data.instagram_business_account;
}
```

If this comes back empty, the client hasn't linked an Instagram Business (not personal/creator) account to that Page — surface a clear message in your UI rather than a silent failure, since this is a common setup gap.

### 3. Page-level insights

```typescript
async getPageInsights(pageId: string, pageToken: string) {
  return axios.get(`https://graph.facebook.com/${version}/${pageId}/insights`, {
    headers: { Authorization: `Bearer ${pageToken}` },
    params: { metric: 'page_impressions,page_engaged_users,page_fans', period: 'day' },
  });
}
```

### 4. Instagram-level insights

```typescript
async getInstagramInsights(igAccountId: string, pageToken: string) {
  return axios.get(`https://graph.facebook.com/${version}/${igAccountId}/insights`, {
    headers: { Authorization: `Bearer ${pageToken}` },
    params: { metric: 'impressions,reach,profile_views', period: 'day' },
  });
}
```

Note: Instagram Insights metrics have changed across API versions more than other surfaces — double check current valid `metric` values against the version you've pinned, some older metric names get deprecated.

## Required scopes

`pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`

## Estimated time

3-4 days.
