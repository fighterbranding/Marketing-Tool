# Analytics store

## Overview

TimescaleDB hypertable holding daily (or hourly, if you need finer granularity later) performance metrics per campaign per client. Optimized for the dashboard's core query pattern: "show me this metric over this date range, broken down by day."

## Setup

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE campaign_metrics (
  time          TIMESTAMPTZ NOT NULL,
  client_id     UUID NOT NULL,
  campaign_id   TEXT NOT NULL,  -- Meta's campaign ID
  adset_id      TEXT,
  ad_id         TEXT,
  impressions   BIGINT,
  reach         BIGINT,
  spend_cents   BIGINT,
  clicks        BIGINT,
  conversions   BIGINT,
  conversion_value_cents BIGINT,
  ctr           NUMERIC(6,4),
  cpm_cents     BIGINT,
  cpc_cents     BIGINT
);

SELECT create_hypertable('campaign_metrics', 'time');

CREATE INDEX idx_metrics_client_campaign ON campaign_metrics (client_id, campaign_id, time DESC);
```

## Upsert pattern (for sync engine re-runs)

```sql
INSERT INTO campaign_metrics (time, client_id, campaign_id, impressions, reach, spend_cents, clicks, conversions, conversion_value_cents, ctr, cpm_cents, cpc_cents)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (time, client_id, campaign_id) DO UPDATE SET
  impressions = EXCLUDED.impressions,
  reach = EXCLUDED.reach,
  spend_cents = EXCLUDED.spend_cents,
  clicks = EXCLUDED.clicks,
  conversions = EXCLUDED.conversions,
  conversion_value_cents = EXCLUDED.conversion_value_cents;
```

Requires a unique constraint on `(time, client_id, campaign_id)` — add this alongside the hypertable creation. This upsert is what makes the sync engine safe to re-run for an overlapping date range (e.g. picking up late-arriving conversion attribution) without creating duplicate rows.

## Common dashboard queries

**Daily trend for a date range:**
```sql
SELECT time::date AS day, SUM(spend_cents) AS spend, SUM(impressions) AS impressions
FROM campaign_metrics
WHERE client_id = $1 AND time >= $2 AND time < $3
GROUP BY day
ORDER BY day;
```

**Continuous aggregate for fast dashboard loads** (precomputed rollups, refreshed automatically):
```sql
CREATE MATERIALIZED VIEW campaign_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS day,
  client_id,
  campaign_id,
  SUM(spend_cents) AS spend_cents,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks
FROM campaign_metrics
GROUP BY day, client_id, campaign_id;

SELECT add_continuous_aggregate_policy('campaign_metrics_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

Query the continuous aggregate instead of the raw table for the dashboard's default views — it's dramatically faster once you have meaningful data volume, and TimescaleDB keeps it updated automatically.

## Retention policy

Decide early how long you keep raw (non-aggregated) data. A reasonable default: keep raw daily rows for 2 years, which covers any reasonable client reporting need, and use TimescaleDB's compression feature on data older than 90 days to control storage cost.

```sql
SELECT add_compression_policy('campaign_metrics', INTERVAL '90 days');
```

## Estimated time

2-3 days for schema, upsert logic, and the first continuous aggregate.
