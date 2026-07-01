# Skills, libraries, and tools reference

A "skill" here means a reusable capability — an SDK, library, or Claude Code skill — that handles a specific piece of this build so you're not writing it from scratch. Organized by layer.

## Claude Code skills (if you're using Claude Code to build this)

If you're working in Claude Code (the CLI/IDE agent), this is a community framework worth installing for a project of this size:

- **Superpowers** (by obra) — a software development methodology built on composable skills: it forces planning/spec clarification before coding, breaks work into small verifiable tasks, enforces TDD, and runs structured code review. Useful here because this project has a lot of repeated structure across modules (every Meta API integration needs: client wrapper, DTOs, error handling, tests, rate-limit backoff) — Superpowers' planning and task-breakdown skills help keep that pattern consistent across the auth service, sync engine, and each API module instead of drifting module to module.

  Install (official marketplace):
  ```
  /plugin install superpowers@claude-plugins-official
  ```
  or via the community marketplace:
  ```
  /plugin marketplace add obra/superpowers-marketplace
  /plugin install superpowers@superpowers-marketplace
  ```
  Verify with `/skills` after install.

- **A custom "meta-api" skill** — worth writing yourself once you've built the first integration (e.g. Insights API). Document the pattern (auth header injection, rate-limit backoff, pagination cursor handling) as a project-local skill so the same pattern gets reused for Marketing API, Pages API, etc. without drift. Superpowers supports project-local skills in `.claude/skills/` alongside the installed plugin.

## Backend (Node.js / NestJS)

| Need | Library | Notes |
|---|---|---|
| Meta Graph/Marketing API calls | `facebook-nodejs-business-sdk` | Official Meta SDK, covers Marketing API, Pages, Insights |
| HTTP client (fallback/custom calls) | `axios` | For any endpoint the official SDK doesn't cover well |
| OAuth flow | `@nestjs/passport` + `passport-facebook` | Standard NestJS auth pattern |
| Token encryption | `node:crypto` (built-in, AES-256-GCM) | Don't add a third-party lib for this — built-in is sufficient and auditable |
| Job queue | `@nestjs/bull` + `bullmq` | Scheduled sync jobs, retries, backoff |
| Postgres ORM | `Prisma` or `TypeORM` | Prisma recommended — better TypeScript inference, easier migrations |
| Rate limiting | `@nestjs/throttler` | Protects your API gateway; separately you must respect Meta's own rate limits (see Meta API docs below) |
| Validation | `class-validator` + `class-transformer` | Standard NestJS pattern for DTOs |
| Background WhatsApp messaging | `whatsapp-business` API (Meta's own Cloud API) | Not a separate "WhatsApp open API" — Meta retired the old on-premise API; use the official WhatsApp Cloud API now, accessed the same way as other Meta Graph API calls with the right token scope |

### A note on "WhatsApp open API"

If you've seen this term referenced elsewhere: Meta deprecated the old self-hosted **WhatsApp Business API (On-Premises)** — it's no longer the recommended path. The current official option is the **WhatsApp Cloud API**, which is just another Graph API surface authenticated the same way as your Facebook/Instagram integration (same OAuth flow, same App, different scope: `whatsapp_business_messaging`). You don't need a separate SDK or separate skill for this — it slots into the same `auth-service` and API client pattern as everything else. Only reach for a dedicated WhatsApp SDK if you're sending high volumes of templated messages and want helper methods for template management.

## Frontend (Next.js / React)

| Need | Library | Notes |
|---|---|---|
| Charts | `recharts` | Good fit for the analytics dashboard, composable React API |
| Tables/data grids | `@tanstack/react-table` | Campaign lists, headless so it fits your design system |
| Forms | `react-hook-form` + `zod` | Campaign creation forms have complex validation (budgets, targeting) |
| State/data fetching | `@tanstack/react-query` | Handles caching/refetching of analytics data well |
| Date handling | `date-fns` | Lighter than moment.js, fine for report date ranges |
| PDF export | `@react-pdf/renderer` or server-side `puppeteer` | For the Reports module |

## Storage

| Need | Tool | Notes |
|---|---|---|
| Primary relational DB | PostgreSQL 16+ | |
| Time-series analytics | TimescaleDB extension on Postgres | Avoids running a second separate database system |
| Cache + token store | Redis 7+ | |
| Job queue backend | Redis (via BullMQ) | Same Redis instance can serve both cache and queue in early stages |

## Meta-specific developer tools

- **Graph API Explorer** (developers.facebook.com/tools/explorer) — test API calls and permissions manually before writing code.
- **Access Token Debugger** (developers.facebook.com/tools/debug/accesstoken) — inspect token scopes, expiry, and which app issued it. Use this constantly while building Auth.
- **Webhooks tool** in the App Dashboard — lets you test webhook payloads without needing a live client.
- **Business Manager (business.facebook.com)** — create a test Business Manager + test ad account here for development, so you're not testing against a real client's data.

## Infra / DevOps

| Need | Tool | Notes |
|---|---|---|
| Containerization | Docker + Docker Compose | One compose file for Postgres + Redis + backend + frontend in local dev |
| CI | GitHub Actions | Lint, test, build on every push |
| Secrets | GitHub Actions secrets / your hosting provider's env vars | Never commit `.env` — see `.gitignore` |
| Hosting (backend) | Railway, Render, or Fly.io for MVP; AWS/GCP later | Pick based on team familiarity — not critical to decide now |
| Hosting (frontend) | Vercel | Native Next.js support |

## Suggested install order when you start coding

```bash
# Backend
npm i @nestjs/core @nestjs/common @nestjs/platform-express
npm i facebook-nodejs-business-sdk
npm i @nestjs/passport passport-facebook
npm i @nestjs/bull bullmq
npm i prisma @prisma/client
npm i @nestjs/throttler class-validator class-transformer

# Frontend
npx create-next-app@latest frontend --typescript --tailwind
npm i recharts @tanstack/react-table @tanstack/react-query react-hook-form zod date-fns
```
