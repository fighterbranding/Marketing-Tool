# Phase 3 Backend Design — Insights API + Sync Engine

Date: 2026-07-02

## Overview

Build the backend infrastructure to pull ad performance data from Meta, store it locally, and serve it to the frontend dashboard. Meta API calls are stubbed with minimal mock data until the Meta developer app is set up.

## Decisions

- **Analytics store:** Raw SQL migration for `campaign_metrics` hypertable (TimescaleDB). Prisma manages all other tables. Access via `prisma.$queryRaw` with typed wrappers.
- **Mock data:** Minimal — one fixed row per sync call, enough to confirm the pipeline works end-to-end.
- **Manual sync trigger:** Yes — a POST endpoint to kick off a sync immediately, for development use.

## Module Structure

Three new NestJS modules:

```
backend/src/
  meta-client/
    meta-client.module.ts
    meta-client.service.ts       ← stubbed Meta API calls
  sync/
    sync.module.ts
    sync.scheduler.ts            ← cron trigger (every 15 min)
    sync.processor.ts            ← BullMQ job handler
    sync.controller.ts           ← manual trigger endpoint
  analytics/
    analytics.module.ts
    analytics.repository.ts      ← $queryRaw against TimescaleDB
    analytics.service.ts
    analytics.controller.ts      ← REST endpoint
```

## Data Flow

```
Cron (every 15 min)
  └─→ SyncScheduler enqueues one BullMQ job per active MetaConnection
        └─→ SyncProcessor handles each job
              ├─→ MetaClientService.getInsights()  ← returns mock data (stub)
              └─→ AnalyticsRepository.upsertMetrics()  ← INSERT ... ON CONFLICT DO UPDATE

Frontend GET /analytics/insights?clientId=X&from=Y&to=Z
  └─→ AnalyticsController → AnalyticsService → AnalyticsRepository
        └─→ Returns summary totals + daily breakdown array

POST /sync/trigger/:connectionId  ← manual trigger for development
  └─→ Adds job directly to BullMQ queue
```

## Database Schema

File: `prisma/timescale.sql` — run once manually after Docker starts.

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS campaign_metrics (
  time                   TIMESTAMPTZ NOT NULL,
  client_id              UUID NOT NULL,
  campaign_id            TEXT NOT NULL,
  impressions            BIGINT DEFAULT 0,
  reach                  BIGINT DEFAULT 0,
  spend_cents            BIGINT DEFAULT 0,
  clicks                 BIGINT DEFAULT 0,
  conversions            BIGINT DEFAULT 0,
  conversion_value_cents BIGINT DEFAULT 0,
  ctr                    NUMERIC(6,4) DEFAULT 0,
  cpm_cents              BIGINT DEFAULT 0,
  cpc_cents              BIGINT DEFAULT 0
);

SELECT create_hypertable('campaign_metrics', 'time', if_not_exists => TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_unique
  ON campaign_metrics (time, client_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_metrics_client_campaign
  ON campaign_metrics (client_id, campaign_id, time DESC);
```

## Mock Stub (MetaClientService)

Returns one fixed row per call:
```typescript
{ campaignId: 'mock-001', impressions: 100, clicks: 5, spend_cents: 500, conversions: 1 }
```

Replacing with real Meta API calls later requires only changing this service.

## Analytics Endpoint

```
GET /analytics/insights?clientId=xxx&from=2026-06-01&to=2026-06-30
```

Response shape:
```json
{
  "summary": {
    "spend": 1500.00,
    "impressions": 45000,
    "clicks": 320,
    "conversions": 12
  },
  "daily": [
    { "day": "2026-06-01", "spend": 50.00, "impressions": 1500, "clicks": 10 }
  ]
}
```

JWT guard enforces that only users belonging to the requested client can access that client's data.

## Error Handling

| Scenario | Behaviour |
|---|---|
| Network blip / Meta rate limit | Retry up to 3 times with exponential backoff (5s, 10s, 20s) |
| Expired / revoked token (Meta error code 190) | Stop immediately, mark connection as `NEEDS_RECONNECT`, no retries |
| Deleted ad account | Same as revoked token |

## BullMQ Job Options

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400 },   // keep 1 day for debugging
  removeOnFail: { age: 604800 },      // keep 7 days for investigation
}
```

## Out of Scope (Phase 3)

- Real Meta API calls (blocked until Meta developer app is ready)
- Frontend dashboard (separate design session)
- Campaign write access (Phase 4)
- Webhook events (Phase 5)
