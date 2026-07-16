# Marketing Tool — Claude Code context

## What this is
A multi-client SaaS platform connecting to clients' Meta Business accounts (Facebook, Instagram, WhatsApp) to display analytics and manage ad campaigns.

## Stack
- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Backend:** NestJS (Node.js / TypeScript)
- **Primary DB:** PostgreSQL 16+
- **Analytics DB:** TimescaleDB (Postgres extension)
- **Cache / tokens:** Redis 7+
- **Job queue:** BullMQ
- **External API:** Meta Graph API / Marketing API

## Repo structure
- `backend/` — NestJS API
- `frontend/` — Next.js app
- `infra/` — Docker, Docker Compose, deployment configs
- `docs/` — Architecture docs, blueprint, and per-module specs

## Build order (phases)
See `docs/BLUEPRINT.md` for the full plan. Short version:
1. Phase 0 — Meta App setup (developers.facebook.com)
2. Phase 1 — DB schema + NestJS skeleton + Redis
3. Phase 2 — Meta OAuth + token storage (critical path — nothing else works without this)
4. Phase 3 — Insights API + sync engine + analytics dashboard
5. Phase 4 — Campaign management (write access)
6. Phase 5 — Pages, Instagram, WhatsApp, webhooks
7. Phase 6 — Reporting + export

## Key conventions
- All backend modules follow: controller → service → repository pattern (NestJS standard)
- DTOs validated with `class-validator` + `class-transformer`
- ORM: Prisma (preferred over TypeORM for TypeScript inference)
- Meta API calls always go through a shared client wrapper that handles: auth headers, rate-limit backoff, pagination cursors
- Never commit `.env` — use `.env.example` with blank values
- Tests required for all services before moving to the next phase

## Important docs
- `docs/PROJECT_STATUS.md` — **read this first** — current phase progress, known gaps, and the next recommended tasks. Keep it updated as work happens, especially across tools/sessions.
- `docs/02-backend/auth-service.md` — everything depends on auth
- `docs/SKILLS.md` — libraries to use at each layer
- `docs/03-meta-api/` — Meta API integration specs per surface
