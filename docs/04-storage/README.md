# Storage layer overview

| Component | File | Purpose |
|---|---|---|
| Primary DB | [primary-db.md](primary-db.md) | Postgres — clients, users, connections, campaigns config |
| Analytics store | [analytics-store.md](analytics-store.md) | TimescaleDB — time-series performance metrics |
| Cache | [cache.md](cache.md) | Redis — sessions, token caching, rate-limit counters |
| Job queue | [job-queue.md](job-queue.md) | Redis-backed BullMQ — sync and report jobs |

## Why two databases instead of one

Primary DB (Postgres) handles low-volume, relational data: clients, users, which Meta accounts are connected, campaign configuration. This data is read/written in normal request/response patterns and benefits from strong relational integrity (foreign keys between clients → connections → campaigns).

Analytics store (TimescaleDB, a Postgres extension) handles high-volume time-series data: daily/hourly metric rows per campaign per client, potentially millions of rows once you have many clients with long history. Querying "show me spend trend for the last 90 days" against a plain Postgres table with millions of rows gets slow; TimescaleDB's hypertables are built for exactly this query pattern (time-bucketed aggregation).

Running TimescaleDB as an extension on the same Postgres instance (rather than a wholly separate database technology) keeps operational complexity down — you still only manage one database server in early stages, just with two logical databases/schemas.
