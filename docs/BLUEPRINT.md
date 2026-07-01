# Blueprint: build order and phases

This is the master plan. Each phase links to detailed docs for the squares involved. Build top-to-bottom — later phases depend on earlier ones.

## Phase 0 — Meta App setup (before writing any code)

You cannot build anything without a Meta App ID. Do this first, it has the longest lead time.

1. Create an app at developers.facebook.com → choose "Business" type.
2. Add the "Marketing API" and "Facebook Login for Business" products.
3. Configure OAuth redirect URIs (your future callback URL).
4. Start **Business Verification** — Meta verifies your company identity. Takes 2-5 business days, sometimes longer if documents are unclear.
5. Note your App ID and App Secret — these go in `.env`.

**Do not wait for full App Review to start building.** In development mode, your app can access ad accounts/pages where *you* (the developer) are an admin. Use a test Business Manager account to build against while App Review is in progress.

Est. time: 30 min of setup + 2-5 days of waiting (parallelize with Phase 1).

---

## Phase 1 — Foundation (Backend + Storage skeleton)

Build the skeleton before any Meta integration.

| Square | Doc | What you're building |
|---|---|---|
| Primary DB | [04-storage/primary-db.md](04-storage/primary-db.md) | Postgres schema: clients, users, meta_connections, campaigns |
| API gateway | [02-backend/api-gateway.md](02-backend/api-gateway.md) | NestJS app skeleton, module structure, rate limiting |
| Cache | [04-storage/cache.md](04-storage/cache.md) | Redis setup for sessions and token caching |

Est. time: 2-3 days.

---

## Phase 2 — Auth (the critical path)

Nothing in Phase 3+ works without this. This is where most teams lose time, so don't rush it.

| Square | Doc | What you're building |
|---|---|---|
| Auth service | [02-backend/auth-service.md](02-backend/auth-service.md) | Meta OAuth flow, token exchange, encrypted storage |
| Client accounts (FE) | [01-frontend/client-accounts.md](01-frontend/client-accounts.md) | "Connect Meta account" UI, account switcher |

Est. time: 3-5 days, plus buffer for App Review back-and-forth.

---

## Phase 3 — Read-only data (Insights)

Build read access before write access — lower risk, validates your token/permission setup, and gives you something demoable.

| Square | Doc | What you're building |
|---|---|---|
| Insights API | [03-meta-api/insights-api.md](03-meta-api/insights-api.md) | Pulling campaign/ad performance metrics |
| Sync engine | [02-backend/sync-engine.md](02-backend/sync-engine.md) | Scheduled jobs pulling data into your DB |
| Job queue | [04-storage/job-queue.md](04-storage/job-queue.md) | BullMQ setup for sync jobs |
| Analytics store | [04-storage/analytics-store.md](04-storage/analytics-store.md) | TimescaleDB schema for metrics |
| Analytics dashboard (FE) | [01-frontend/analytics-dashboard.md](01-frontend/analytics-dashboard.md) | Charts, KPI cards |

Est. time: 1-2 weeks.

---

## Phase 4 — Write access (campaign management)

Now that read access is solid, add the ability to create/edit campaigns. This is the highest-risk surface for App Review (Meta scrutinizes write access heavily).

| Square | Doc | What you're building |
|---|---|---|
| Marketing API | [03-meta-api/marketing-api.md](03-meta-api/marketing-api.md) | Create/edit/pause campaigns, ad sets, ads |
| Campaign manager (FE) | [01-frontend/campaign-manager.md](01-frontend/campaign-manager.md) | UI for campaign CRUD |

Est. time: 2-3 weeks (campaign creation forms are deceptively complex — targeting, budgets, creative).

---

## Phase 5 — Pages, Instagram, WhatsApp

| Square | Doc | What you're building |
|---|---|---|
| Pages API | [03-meta-api/pages-api.md](03-meta-api/pages-api.md) | FB Page, IG Business account data |
| Business Manager API | [03-meta-api/business-manager-api.md](03-meta-api/business-manager-api.md) | Linking client BM accounts, asset permissions |
| Webhooks | [02-backend/webhooks.md](02-backend/webhooks.md) | Real-time event listener |

Est. time: 1-2 weeks.

---

## Phase 6 — Reporting & polish

| Square | Doc | What you're building |
|---|---|---|
| Reports (FE) | [01-frontend/reports.md](01-frontend/reports.md) | PDF/CSV export |

Est. time: 1 week.

---

## Rough total timeline

8-12 weeks for a solo or small-team build to a production-ready first version, not counting Meta App Review wait time (which runs in parallel but can gate your public launch by 2-4 weeks on its own).

## Critical path dependency chain

```
Meta App created → Auth service → Sync engine → Insights API → Dashboard
                                 → Marketing API → Campaign manager
```

Everything downstream of Auth blocks until Auth is solid. Build and test Auth thoroughly with your own test Business Manager before connecting a real client.
