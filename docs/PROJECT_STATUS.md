# Project status

Living status doc for continuing work when Claude Code isn't available (e.g. in
Cursor, or by hand) and for Claude Code to catch up quickly when it comes back.
Update the checklists as you go — that's what makes this useful.

## How to use this doc

**Continuing work in another tool (Cursor, etc.):**
1. Read the root `CLAUDE.md` first — it has the stack, repo structure, and
   coding conventions (controller → service → repository, DTOs with
   class-validator, Meta calls always through `MetaClientService`, tests
   required for services).
2. Read this file for current status and the "Next up" list below.
3. Pick the next unchecked task, or something from "Known gaps."
4. Follow existing patterns — look at a recently-built module (e.g.
   `backend/src/ad-accounts/` or `backend/src/webhooks/`) for the shape a new
   module should take: controller/service/repository split, a `.spec.ts` per
   service using the mocked-DI pattern already used throughout, error mapping
   through `MetaClientService.toMetaError`.
5. Check off what you finish, add new gaps you find under "Known gaps," and
   leave a one-line note under "Session log" with the date.
6. Do **not** commit `.env` or real credentials. Do not push to `origin`
   unless explicitly asked.

**When Claude Code resumes:**
Tell it to read this file and run `git log --oneline <last-known-commit>..HEAD`
plus `git diff <last-known-commit>..HEAD` to see what changed. It should
review the new work the same way it reviews its own — correctness, and
whether it matches the conventions in `CLAUDE.md` and the patterns of
surrounding code — before treating it as done. The commit hash as of the last
Claude Code session is recorded in "Session log" below; update that line
whenever a session (yours or Claude's) ends.

---

## Phase progress (against `docs/BLUEPRINT.md`)

| Phase | Status | Notes |
|---|---|---|
| 0 — Meta App setup | **Blocked / not done** | `META_APP_ID` / `META_APP_SECRET` still empty in `backend/.env`. This is the single blocker preventing any live testing of everything below. |
| 1 — Foundation | Done | NestJS skeleton, Postgres schema, Redis cache/queue wiring. |
| 2 — Auth | Done, hardened | Meta OAuth flow, encrypted token storage, `/auth/meta/status`. Fixed this session: connect/callback previously 401'd on real browser navigation (JwtAuthGuard doesn't work on a plain redirect); replaced with a short-lived single-use ticket + CSRF `state` token pattern. |
| 3 — Read-only data (Insights) | Done, real API wired | Dashboard, KPI cards, TrendChart, sync engine, TimescaleDB all built. `getInsights()` was a hardcoded mock until this session — now calls the real Meta Insights API. **Never verified against a real ad account** (no Meta App yet). |
| 4 — Write access (campaigns) | Done | Campaigns, ad sets (full interest-picker targeting), ads (image upload + creative), all with create/edit/delete/status-toggle, both backend and frontend. |
| 5 — Pages, Instagram, Business Manager, Webhooks | Done | Pages API (with linked IG account), Business Manager ad-account discovery/selection, Webhooks receiver (verify handshake + signature-checked queue). WhatsApp not built (not currently scoped/requested). |
| 6 — Reporting & polish | **Not started** | Needs scope decisions from you: which metrics, PDF vs CSV, on-demand vs scheduled. |

---

## Known gaps / tech debt

Roughly in priority order:

- [ ] **Meta App credentials missing** — `backend/.env` has `META_APP_ID=""` / `META_APP_SECRET=""`. Nothing below can be verified against real Meta data until this is filled in. See `docs/BLUEPRINT.md` Phase 0 for setup steps.
- [ ] **Currency hardcoded to `$`** — `frontend/components/trend-chart.tsx:33` always prefixes spend with `$`, but Meta returns `spend`/`cpm`/`cpc` in the ad account's own currency (confirmed against live Meta docs). A non-USD client's dashboard would show the right numbers with the wrong symbol. Pre-existing (Phase 3), not from this session.
- [ ] **Token decryption duplicated 3x** — `SyncProcessor`, `AdAccountsService`, and `PagesService` each inline `encryption.decrypt(conn.encryptedToken, conn.encryptionIv, conn.encryptionTag)`. This exact duplication already caused one real bug this session (`SyncProcessor` was passing the *encrypted* token straight to Meta). Worth centralizing into a single "get live token for connection" helper — touches 3 already-tested modules, so do it carefully with full test re-runs.
- [ ] **`getInsights()` conversions is a simplification** — sums all Meta `actions` except a denylist of known engagement types (link clicks, post engagement, etc.). Correct in that it no longer overcounts wildly, but doesn't map per-objective conversion definitions (e.g. distinguishing a `lead` campaign's real conversion event from a `sales` campaign's). Revisit once real campaigns with real objectives exist to test against.
- [ ] **Webhooks processor just logs events** — `backend/src/webhooks/webhooks.processor.ts` intentionally has no per-field business logic yet, because no fields are subscribed in the Meta App Dashboard yet. Once you pick which fields to subscribe to (only subscribe to what you'll act on, per `docs/02-backend/webhooks.md`), add handling here.
- [ ] **Graph API pinned to v21.0** — confirmed still valid/supported (checked against live Meta docs), but current latest is v25.0. Not urgent since Meta hasn't announced a deprecation date, but don't let it drift indefinitely.
- [ ] **No System User token flow** — deferred earlier in favor of user-OAuth + ad account selection. Revisit if/when this needs to run unattended per-client without a human's OAuth session.
- [ ] **Local Postgres/Redis are manually-started processes**, not persistent services (no launchd unit). Will need manual restart after a reboot. See "Local dev environment" below for exact commands.
- [ ] **Phase 6 (Reporting & export) unscoped** — needs your input before it can be built: which metrics, PDF vs CSV, on-demand vs scheduled email.

---

## Next up (recommended order)

1. Meta App setup (Phase 0 steps in `docs/BLUEPRINT.md`) — unblocks everything else being verified for real.
2. Once connected: walk the full OAuth flow, then verify every write path (campaign/ad set/ad create-edit-delete, Pages, ad account selection) against real data — they're unit-tested against mocked Meta responses but never driven end-to-end against the real Graph API.
3. Fix currency formatting (`trend-chart.tsx`) — quick, self-contained, no Meta credentials needed to build (though best verified with a non-USD test account).
4. Centralize token decryption (see "Known gaps") — do this with care, re-run all three modules' test suites.
5. Scope Phase 6 with your input.

---

## Local dev environment

No Docker/Homebrew on this machine — everything built from source. Quick reference if starting fresh:

```bash
# Postgres 16 (with TimescaleDB extension already built in)
~/dev-services/pg16/bin/pg_ctl -D ~/dev-services/pg-data -l ~/dev-services/pg-data/log start

# Redis
~/dev-services/redis-stable/src/redis-server --daemonize yes

# Backend (from backend/)
npm run start:dev

# Frontend (from frontend/)
npm run dev
```

Backend runs on `:3000`, frontend on `:3001`. `backend/.env` holds all local
config (DB/Redis URLs, JWT secret, token encryption key, Meta App
credentials — currently empty).

---

## Session log

Append a line each time a work session (Claude or otherwise) ends, so the
next session — whichever tool runs it — knows where things stand.

- **2026-07-16 (Claude Code)** — HEAD at `3cecc3a` plus an uncommitted diff on
  top (not yet committed — ask before committing): `/auth/meta/status`
  endpoint, OAuth connect/callback flow fixed (ticket + CSRF state), real
  `getInsights()` wired up (with the token-decrypt bug fix in
  `SyncProcessor`), Webhooks module built (Phase 5 complete), plus a
  multi-agent review of all of the above with 5 bugs found and fixed. This
  file created in response to a request for a durable way to keep working via
  another tool during Claude Code downtime.
