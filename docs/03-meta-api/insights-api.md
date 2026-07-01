# Insights API

## Overview

Read-only performance data: impressions, reach, spend, clicks, conversions, ROAS, and dozens of other metrics, queryable at the campaign, ad set, or ad level, broken down by date range, demographics, placement, or device.

Build this before the Marketing API (write access) — it's lower risk for App Review, validates your auth setup, and gives you a demoable product fastest.

## Implementation

### 1. Basic insights call

```typescript
// meta-client.service.ts
async getInsights(adAccountId: string, token: string, options: InsightsOptions) {
  const url = `https://graph.facebook.com/${process.env.META_API_VERSION}/act_${adAccountId}/insights`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      fields: options.fields.join(','),
      date_preset: options.datePreset, // e.g. 'last_7d', 'last_30d'
      level: options.level ?? 'campaign', // campaign | adset | ad
      time_increment: options.timeIncrement ?? 1, // 1 = daily breakdown
    },
  });
  return res.data;
}
```

### 2. Commonly needed fields

```typescript
const STANDARD_FIELDS = [
  'campaign_name',
  'impressions',
  'reach',
  'spend',
  'clicks',
  'ctr',
  'cpm',
  'cpc',
  'actions',         // conversions, by action type
  'action_values',   // conversion value, for ROAS calc
  'date_start',
  'date_stop',
];
```

`actions` returns an array of `{ action_type, value }` pairs rather than flat fields — you'll need to parse out the specific conversion types your dashboard cares about (e.g. `purchase`, `lead`, `link_click`).

### 3. Custom date ranges

For anything beyond Meta's presets, use `time_range`:

```typescript
params: {
  time_range: JSON.stringify({ since: '2026-06-01', until: '2026-06-30' }),
}
```

### 4. Async insights for large pulls

For accounts with long history or many campaigns, synchronous insight calls can time out. Use the async insights job pattern:

```typescript
// 1. Request the report
const job = await axios.post(`${baseUrl}/insights`, { ...params, async: true });
const reportRunId = job.data.report_run_id;

// 2. Poll for completion
let status;
do {
  await sleep(2000);
  const check = await axios.get(`https://graph.facebook.com/${version}/${reportRunId}`);
  status = check.data.async_status;
} while (status === 'Job Running');

// 3. Fetch results once complete
const results = await axios.get(`https://graph.facebook.com/${version}/${reportRunId}/insights`);
```

Use this in the sync engine's nightly full-reconciliation job, not the frequent 15-minute incremental sync (that one should stay synchronous and scoped to a short recent window).

### 5. Mapping into your analytics store

Each insights row should map to a row in your TimescaleDB hypertable (see [04-storage/analytics-store.md](../04-storage/analytics-store.md)), keyed by `(client_id, campaign_id, date)` so re-running a sync for an overlapping date range upserts rather than duplicates.

## Required scope

`ads_read` (or `ads_management`, which includes read access).

## Estimated time

3-4 days for the core integration, plus 2-3 days for async/large-account handling.
