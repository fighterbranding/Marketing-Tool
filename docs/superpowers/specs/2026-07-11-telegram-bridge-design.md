# Telegram Bridge for Claude Code — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorming session)

## Purpose

Let Andrey drive Claude Code in this repository from his phone via Telegram: send a task, watch progress, and approve "big steps" (commits, pushes, deletions) with a tap. Claude executes everything locally on the Mac, in this working copy.

## Decisions made

| Question | Decision |
|---|---|
| What the agent does | Remote-controls Claude Code (not a product feature, not notifications-only) |
| Hosting | Daemon on the Mac; Telegram long-polling (no public IP/server needed) |
| Approval granularity | Big steps only — autonomous on safe ops, asks for risky ones |
| Scope | This repo only; fixed working directory |
| Implementation | Custom TypeScript daemon on the official Claude Agent SDK (Approach A) |

Rejected alternatives: adopting a third-party open-source bridge (trust/security — third-party code would get shell access); hooks + tmux injection (brittle, no clean inline-button approvals); VPS hosting (credentials off-machine, works on a clone instead of the real working copy — can revisit later since the daemon is portable).

## Architecture

New self-contained package at `tools/telegram-bridge/` (tooling, not product code — outside `frontend/` and `backend/`):

```
tools/telegram-bridge/
├── src/
│   ├── main.ts      # startup, env validation, wiring
│   ├── bot.ts       # grammY bot: long-polling, user-ID guard, commands
│   ├── session.ts   # wraps Agent SDK query(); one session at a time, resumable
│   ├── policy.ts    # "big steps" approval rules (pure function, unit-tested)
│   └── format.ts    # chunks output to Telegram's 4096-char message limit
├── .env.example     # TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID (blank values)
└── package.json     # deps: grammy, @anthropic-ai/claude-agent-sdk
```

- **Telegram side:** grammY with long-polling. Every incoming update is checked against `TELEGRAM_USER_ID`; all other senders are ignored.
- **Claude side:** `@anthropic-ai/claude-agent-sdk` `query()` with `cwd` fixed to the repo root. Auth reuses the existing Claude Code login (one-time `claude setup-token`); no API billing.
- **Secrets:** bot token and user ID in `tools/telegram-bridge/.env`, never committed (repo convention: `.env.example` with blank values).

## Data flow

1. User texts the bot → user-ID guard → message becomes the prompt for a new session, or a follow-up to the active one.
2. SDK streams messages; each completed assistant message is posted to the chat (chunked to ≤4096 chars) — progress in readable pieces, not token-by-token.
3. When a tool call matches the risky policy, the daemon posts a description with inline **✅ Go ahead / ❌ Stop** buttons and blocks the SDK's `canUseTool` callback until the user taps. Plan-mode proposals are likewise forwarded for approval.
4. Turn ends → summary posted. A plain reply continues the same session.

**Commands:** `/new` (fresh session), `/stop` (interrupt running turn), `/status` (what it's doing).

**Concurrency:** one session at a time. Plain messages received while a turn is running are queued for the next turn.

## Approval policy ("big steps only")

- **Auto-approved, silent:** file reads/edits/writes inside the repo; searches; non-destructive shell (tests, builds, `git status/diff/log`, typecheck/lint).
- **Requires Telegram approval:** `git commit`, `git push`, file/branch deletion, installing new packages, any shell command matching risky patterns (`rm`, `sudo`, credential-touching, paths outside the repo). Plan approvals.
- **Default for unmatched cases: ask.** The auto-approve list is the explicit allowlist; asking is the fallback.

## Error handling

- Approval unanswered for 1 hour → treated as deny; session pauses with a notice in the chat. Nothing hangs indefinitely.
- SDK or Telegram API errors are posted to the chat, not swallowed; transient Telegram errors are retried.
- A `launchd` agent starts the daemon at login and restarts it on crash, so it survives reboots (Mac must still be awake for it to run).

## Testing

- Unit tests for `policy.ts` (risky-command matcher — the safety-critical piece) and `format.ts` (chunking).
- Bot loop verified end-to-end manually from the phone: task → progress messages → approval buttons → local execution.

## Out of scope (YAGNI)

- Multi-project support (`/project` switching) — revisit after the workflow proves itself.
- Multi-user access, group chats.
- VPS deployment.
- Voice messages, file uploads, screenshots.
