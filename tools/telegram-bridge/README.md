# Telegram Bridge

Drive Claude Code in this repo from Telegram. Design spec:
`docs/superpowers/specs/2026-07-11-telegram-bridge-design.md`.

## One-time setup

1. **Create the bot:** message [@BotFather](https://t.me/BotFather) on Telegram,
   send `/newbot`, pick a name and username. Copy the bot token.
2. **Find your user id:** message [@userinfobot](https://t.me/userinfobot);
   it replies with your numeric id.
3. **Configure:** `cp .env.example .env` and fill in both values.
   Never commit `.env`.
4. **Claude auth:** the daemon reuses this Mac's Claude Code login.
   If sessions fail with an auth error, run `claude setup-token` once.
5. **Install deps:** `npm install` (inside `tools/telegram-bridge/`).

## Run manually

```bash
npm start
```

Then message your bot on Telegram. Commands: `/new` (fresh session),
`/stop` (interrupt), `/status`. Anything else is sent to Claude as a task.

## Security model

The bridge sits between Telegram and a Claude Code session that can run
shell commands and edit files in this repo. Every tool call the session
wants to make is checked against a policy before it runs:

- **Read-only tools** (reading files, searching, web fetches, etc.) are
  always allowed silently — they can't change anything.
- **Ordinary file writes inside the repo** (editing source files) happen
  silently too, so normal work isn't interrupted by approval prompts.
- **Risky shell commands require a ✅ tap**, including: git commits and
  pushes, discarding/rewriting changes (`git reset`/`clean`/`restore`/
  `checkout`), deleting a branch, deleting files (`rm`, `rmdir`, `unlink`,
  `shred`), `sudo`, installing/removing dependencies (`npm`/`pnpm`/`yarn
  install|add|remove`), piping the internet into a shell (`curl | sh`),
  and any command that touches a `.env` file.
- **Any shell command the policy doesn't recognize as safe also requires
  ✅.** The safe list is a small, explicit allowlist (`git status/diff/
  log/show/branch`, `npm|pnpm|yarn test|run`, common read-only/test CLIs
  like `ls`, `cat`, `grep`, `tsc`, `vitest`, etc.) — everything else fails
  closed and asks, including commands with shell redirection, substitution,
  backgrounding (`&`), or unrecognized operators/characters.
- **Writing files outside the repo, or writing any `.env` file, requires
  ✅.**
- **Spawning a helper sub-agent (the `Task` tool) requires ✅.** A
  sub-agent runs its own commands, which would otherwise bypass this gate
  entirely — so starting one is treated as risky in itself.
- **Writing to Claude's own settings under `.claude/`** (e.g.
  `.claude/settings.json`, `.claude/settings.local.json`) **requires ✅.**
  Those files control what gets auto-approved on future turns, so changing
  them is gated even though it's otherwise a plain in-repo file write.
- **Unanswered approvals auto-deny after 1 hour.**

**Residual risk to know about:** Claude loads `.claude/settings.json`
permission rules at the start of every turn. Because writing that file now
requires approval, the bridge itself can no longer *silently* grant new
permissions. But if someone **manually** commits a `.claude/settings.json`
containing `permissions.allow` rules, those rules will auto-approve
matching tools before they ever reach the Telegram gate — the policy above
only governs tools that actually ask. **Recommendation:** keep no
permissive `permissions.allow` rules in a committed `.claude/settings.json`
for this repo.

## Keep it running (launchd)

```bash
cp com.andrey.telegram-bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.andrey.telegram-bridge.plist
```

Starts at login and restarts on crash. Logs: `/tmp/telegram-bridge.log`.
To stop: `launchctl unload ~/Library/LaunchAgents/com.andrey.telegram-bridge.plist`.
Note: the Mac must be awake; this survives reboots, not sleep.

## Manual end-to-end verification (requires the user's phone)

With `.env` filled in, run `npm start`, then from the phone verify each:

1. `/status` → replies "💤 Idle — send me a task."
2. Send `Read CLAUDE.md and summarize this project in two sentences.` →
   progress text arrives, then "✅ Turn finished…". No approval prompt
   (read-only).
3. Send `Run git status and tell me what's changed.` → completes without
   approval (safe command).
4. Send `Create a file named BRIDGE_TEST.md containing "hello", then commit
   it.` → file write happens silently; the **commit** triggers ✅/❌ buttons
   (git commit is on the risky list). Tap ✅ → commit happens; summary
   arrives.
5. Send `Delete BRIDGE_TEST.md and commit the deletion.` → `rm` (or
   equivalent) triggers buttons; tap ❌ → Claude reports it was denied and
   stops. Then clean up manually: `git checkout BRIDGE_TEST.md` deletion or
   approve a follow-up.
6. From a second Telegram account (or ask a friend): message the bot → no
   response at all (auth guard).
7. `/stop` during a running task → "🛑 Interrupted."

Expected: all seven behave as described. Fix anything that doesn't before
committing.
