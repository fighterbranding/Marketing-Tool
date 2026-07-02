CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS campaign_metrics (
  time                   TIMESTAMPTZ     NOT NULL,
  client_id              UUID            NOT NULL,
  campaign_id            TEXT            NOT NULL,
  impressions            BIGINT          DEFAULT 0,
  reach                  BIGINT          DEFAULT 0,
  spend_cents            BIGINT          DEFAULT 0,
  clicks                 BIGINT          DEFAULT 0,
  conversions            BIGINT          DEFAULT 0,
  conversion_value_cents BIGINT          DEFAULT 0,
  ctr                    NUMERIC(6,4)    DEFAULT 0,
  cpm_cents              BIGINT          DEFAULT 0,
  cpc_cents              BIGINT          DEFAULT 0
);

SELECT create_hypertable('campaign_metrics', 'time', if_not_exists => TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_unique
  ON campaign_metrics (time, client_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_metrics_client_campaign
  ON campaign_metrics (client_id, campaign_id, time DESC);
