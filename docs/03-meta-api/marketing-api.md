# Marketing API

## Overview

Write access: create, update, and pause campaigns, ad sets, and ads. This is the highest-scrutiny surface in App Review — Meta wants to see exactly how your UI uses each write permission, with a screen recording. Build this after Insights API is solid (Phase 4 in the blueprint).

## The object hierarchy

Meta's ad structure is three levels, and your data model and UI should mirror it directly:

```
Campaign (objective, overall budget strategy)
  └── Ad Set (targeting, budget, schedule, placement)
        └── Ad (creative: image/video, copy, destination)
```

## Implementation

### 1. Creating a campaign

```typescript
async createCampaign(adAccountId: string, token: string, data: CreateCampaignDto) {
  const res = await axios.post(
    `https://graph.facebook.com/${version}/act_${adAccountId}/campaigns`,
    {
      name: data.name,
      objective: data.objective, // e.g. 'OUTCOME_TRAFFIC', 'OUTCOME_SALES'
      status: 'PAUSED', // always create paused, let the client explicitly launch
      special_ad_categories: data.specialAdCategories ?? [], // required field, [] if none apply
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data; // { id: 'campaign_id' }
}
```

**Always create as `PAUSED`.** Never auto-activate a campaign your platform creates — let the client take the explicit action to launch it. This is both a safety practice (avoids accidental spend) and something App Review looks for.

### 2. Creating an ad set

```typescript
async createAdSet(adAccountId: string, token: string, data: CreateAdSetDto) {
  return axios.post(`https://graph.facebook.com/${version}/act_${adAccountId}/adsets`, {
    name: data.name,
    campaign_id: data.campaignId,
    daily_budget: data.dailyBudgetCents, // budgets are in account currency's smallest unit (cents for USD)
    billing_event: 'IMPRESSIONS',
    optimization_goal: data.optimizationGoal,
    targeting: data.targeting, // see targeting spec below
    status: 'PAUSED',
  }, { headers: { Authorization: `Bearer ${token}` } });
}
```

**Targeting spec** is its own nested object and the most complex part of campaign creation UI-wise:

```typescript
const targeting = {
  geo_locations: { countries: ['US'] },
  age_min: 18,
  age_max: 65,
  interests: [{ id: '6003107902433', name: 'Fitness' }], // looked up via the targeting search endpoint
  publisher_platforms: ['facebook', 'instagram'],
};
```

Use the `/search` targeting endpoint to let clients search interest/behavior targeting options by keyword in your UI rather than hardcoding a list — Meta's targeting taxonomy changes over time.

### 3. Creating an ad (creative + ad)

This is two API calls: first create the ad creative (the actual image/copy), then the ad that references it.

```typescript
async createAdCreative(adAccountId: string, token: string, data: CreateCreativeDto) {
  return axios.post(`https://graph.facebook.com/${version}/act_${adAccountId}/adcreatives`, {
    name: data.name,
    object_story_spec: {
      page_id: data.pageId,
      link_data: {
        image_hash: data.imageHash, // uploaded separately via /adimages first
        link: data.destinationUrl,
        message: data.bodyText,
        call_to_action: { type: data.ctaType },
      },
    },
  }, { headers: { Authorization: `Bearer ${token}` } });
}

async createAd(adAccountId: string, token: string, adSetId: string, creativeId: string) {
  return axios.post(`https://graph.facebook.com/${version}/act_${adAccountId}/ads`, {
    name: data.name,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  }, { headers: { Authorization: `Bearer ${token}` } });
}
```

Images must be uploaded to Meta first via the `/adimages` endpoint, which returns an `image_hash` you reference in the creative.

### 4. Status changes (pause/resume/delete)

```typescript
async updateStatus(objectId: string, token: string, status: 'ACTIVE' | 'PAUSED' | 'DELETED') {
  return axios.post(`https://graph.facebook.com/${version}/${objectId}`, { status }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

Same endpoint pattern works for campaigns, ad sets, and ads — the object ID determines which level you're updating.

### 5. Validation before submission

Build client-side and server-side validation for Meta's constraints before hitting the API — this avoids a bad UX where errors only surface after a slow round trip:

- Minimum daily budget varies by currency and objective (check `/act_{id}` for `min_daily_budget`)
- `special_ad_categories` must be set correctly for housing/employment/credit/social-issue ads — wrong categorization gets the campaign rejected at Meta's own ad review (separate from app review)
- Creative text length limits vary by placement

## Required scopes

`ads_management` (includes read). This is the most heavily reviewed scope — your App Review submission needs to show campaign creation, editing, and pausing in the recorded demo.

## Estimated time

2-3 weeks. The API calls themselves are straightforward; the time sink is the campaign creation UI (targeting picker, budget validation, creative upload flow) and handling Meta's ad-level review process (separate from your app review — each ad you create goes through Meta's own content policy review before it can serve).
