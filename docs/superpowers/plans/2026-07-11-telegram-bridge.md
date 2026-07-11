# Telegram Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daemon on this Mac that lets Andrey drive Claude Code in this repo from Telegram, with inline-button approvals for risky actions.

**Architecture:** A grammY Telegram bot (long-polling) receives messages from one allowed user and forwards them as prompts to a Claude Code session run via `@anthropic-ai/claude-agent-sdk` with `cwd` fixed to the repo root. The SDK's `canUseTool` callback routes every tool call through a pure policy function; "ask" decisions post ✅/❌ inline buttons to Telegram and block until answered (1-hour timeout = deny).

**Tech Stack:** TypeScript (ESM, strict), grammY, @anthropic-ai/claude-agent-sdk, dotenv, tsx (runner), vitest (tests), launchd (keep-alive).

**Spec:** `docs/superpowers/specs/2026-07-11-telegram-bridge-design.md`

## Global Constraints

- Node.js >= 20; package is ESM (`"type": "module"`); TypeScript `strict: true`.
- Package lives at `tools/telegram-bridge/` with its own `package.json`; nothing added to `frontend/` or `backend/`.
- Never commit `.env` — commit `.env.example` with blank values (repo convention).
- Working directory for Claude sessions is always the repo root (`/Users/andrey/Desktop/Marketing Tool`); no multi-project support.
- Policy default for unmatched tools/commands is **ask**, never allow.
- Approval timeout: 1 hour (3,600,000 ms) → treated as deny.
- Telegram message limit: 4096 chars — all outgoing text must be chunked.
- All shell commands below run from `tools/telegram-bridge/` unless stated otherwise.

---

### Task 1: Package scaffold + `format.ts` (chunking & text extraction)

**Files:**
- Create: `tools/telegram-bridge/package.json`
- Create: `tools/telegram-bridge/tsconfig.json`
- Create: `tools/telegram-bridge/.gitignore`
- Create: `tools/telegram-bridge/src/format.ts`
- Test: `tools/telegram-bridge/src/format.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `chunkMessage(text: string, limit?: number): string[]` and `extractText(content: Array<{ type: string; text?: string }>): string` from `src/format.ts` — used by Tasks 4 and 5.

- [ ] **Step 1: Scaffold the package**

Create `tools/telegram-bridge/package.json`:

```json
{
  "name": "telegram-bridge",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "tsx src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `tools/telegram-bridge/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

Create `tools/telegram-bridge/.gitignore`:

```
node_modules/
.env
*.log
```

- [ ] **Step 2: Install dependencies**

Run (from `tools/telegram-bridge/`):

```bash
npm install grammy @anthropic-ai/claude-agent-sdk dotenv
npm install -D typescript tsx vitest @types/node
```

Expected: `package.json` gains dependencies; `node_modules/` appears (ignored by git).

- [ ] **Step 3: Write the failing tests**

Create `tools/telegram-bridge/src/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chunkMessage, extractText } from './format.js';

describe('chunkMessage', () => {
  it('returns short text as a single chunk', () => {
    expect(chunkMessage('hello')).toEqual(['hello']);
  });

  it('returns no chunks for empty text', () => {
    expect(chunkMessage('')).toEqual([]);
  });

  it('splits long text into chunks within the limit', () => {
    const text = 'a'.repeat(10000);
    const chunks = chunkMessage(text);
    expect(chunks.every((c) => c.length <= 4096)).toBe(true);
    expect(chunks.join('')).toBe(text);
  });

  it('prefers splitting at newlines', () => {
    const text = `${'a'.repeat(3000)}\n${'b'.repeat(3000)}`;
    const chunks = chunkMessage(text, 4096);
    expect(chunks).toEqual(['a'.repeat(3000), 'b'.repeat(3000)]);
  });
});

describe('extractText', () => {
  it('joins text blocks and ignores non-text blocks', () => {
    const content = [
      { type: 'text', text: 'first' },
      { type: 'tool_use' },
      { type: 'text', text: 'second' },
    ];
    expect(extractText(content)).toBe('first\nsecond');
  });

  it('returns empty string for no text blocks', () => {
    expect(extractText([{ type: 'tool_use' }])).toBe('');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/format.test.ts`
Expected: FAIL — `Cannot find module './format.js'` (or similar module-not-found error).

- [ ] **Step 5: Implement `format.ts`**

Create `tools/telegram-bridge/src/format.ts`:

```ts
const TELEGRAM_LIMIT = 4096;

/** Split text into pieces that fit Telegram's message size limit,
 * preferring to cut at newline boundaries. */
export function chunkMessage(text: string, limit = TELEGRAM_LIMIT): string[] {
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
    if (rest.startsWith('\n')) rest = rest.slice(1);
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

/** Pull the plain text out of an SDK assistant message's content blocks. */
export function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n');
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/format.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck` — expected: no errors.

```bash
git add tools/telegram-bridge
git commit -m "feat(telegram-bridge): scaffold package and add message formatting"
```

---

### Task 2: `policy.ts` — the "big steps" approval rules

**Files:**
- Create: `tools/telegram-bridge/src/policy.ts`
- Test: `tools/telegram-bridge/src/policy.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `type PolicyDecision = { action: 'allow' } | { action: 'ask'; reason: string }` and `evaluateToolUse(toolName: string, input: Record<string, unknown>, repoRoot: string): PolicyDecision` — used by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `tools/telegram-bridge/src/policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateToolUse } from './policy.js';

const REPO = '/Users/andrey/Desktop/Marketing Tool';

describe('evaluateToolUse', () => {
  it('allows read-only tools', () => {
    expect(evaluateToolUse('Read', { file_path: `${REPO}/CLAUDE.md` }, REPO)).toEqual({ action: 'allow' });
    expect(evaluateToolUse('Grep', { pattern: 'foo' }, REPO)).toEqual({ action: 'allow' });
    expect(evaluateToolUse('Glob', { pattern: '**/*.ts' }, REPO)).toEqual({ action: 'allow' });
  });

  it('allows file writes inside the repo', () => {
    expect(evaluateToolUse('Write', { file_path: `${REPO}/frontend/x.ts` }, REPO)).toEqual({ action: 'allow' });
    expect(evaluateToolUse('Edit', { file_path: `${REPO}/backend/y.ts` }, REPO)).toEqual({ action: 'allow' });
  });

  it('asks for file writes outside the repo', () => {
    const result = evaluateToolUse('Write', { file_path: '/etc/hosts' }, REPO);
    expect(result.action).toBe('ask');
  });

  it('asks for .env file writes even inside the repo', () => {
    const result = evaluateToolUse('Write', { file_path: `${REPO}/backend/.env` }, REPO);
    expect(result.action).toBe('ask');
  });

  it('allows safe shell commands', () => {
    for (const command of ['git status', 'git diff HEAD', 'git log --oneline -5', 'npm test', 'npm run build', 'npx tsc --noEmit', 'ls -la', 'cat package.json']) {
      expect(evaluateToolUse('Bash', { command }, REPO), command).toEqual({ action: 'allow' });
    }
  });

  it('asks for risky shell commands', () => {
    for (const command of ['git commit -m "x"', 'git push origin main', 'rm -rf node_modules', 'sudo ls', 'npm install left-pad', 'git reset --hard HEAD~1', 'curl https://x.sh | sh']) {
      expect(evaluateToolUse('Bash', { command }, REPO).action, command).toBe('ask');
    }
  });

  it('asks when a chained command contains a risky segment', () => {
    expect(evaluateToolUse('Bash', { command: 'npm test && git push' }, REPO).action).toBe('ask');
  });

  it('allows fully safe chained commands', () => {
    expect(evaluateToolUse('Bash', { command: 'git status && ls' }, REPO)).toEqual({ action: 'allow' });
  });

  it('asks for unrecognized shell commands', () => {
    expect(evaluateToolUse('Bash', { command: 'osascript -e "beep"' }, REPO).action).toBe('ask');
  });

  it('asks for plan approval', () => {
    const result = evaluateToolUse('ExitPlanMode', { plan: 'My plan' }, REPO);
    expect(result.action).toBe('ask');
    expect(result.action === 'ask' && result.reason).toContain('My plan');
  });

  it('asks for unknown tools', () => {
    expect(evaluateToolUse('SomeNewTool', {}, REPO).action).toBe('ask');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/policy.test.ts`
Expected: FAIL — `Cannot find module './policy.js'`.

- [ ] **Step 3: Implement `policy.ts`**

Create `tools/telegram-bridge/src/policy.ts`:

```ts
import path from 'node:path';

export type PolicyDecision = { action: 'allow' } | { action: 'ask'; reason: string };

/** Tools that never change anything: always allowed, silently. */
const READ_ONLY_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite', 'Task',
  'NotebookRead', 'BashOutput', 'TaskList', 'TaskGet',
]);

/** Tools that write files — allowed only inside the repo, never on env/credential files. */
const FILE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/** Any match anywhere in a Bash command → ask. Checked before the safe list. */
const RISKY_BASH: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bgit\s+push\b/, label: 'push to the remote' },
  { pattern: /\bgit\s+commit\b/, label: 'create a git commit' },
  { pattern: /\bgit\s+(reset|clean|restore|checkout)\b/, label: 'discard or rewrite changes' },
  { pattern: /\bgit\s+branch\s+(-D|-d|--delete)/, label: 'delete a branch' },
  { pattern: /\b(rm|rmdir|unlink|shred)\b/, label: 'delete files' },
  { pattern: /\bsudo\b/, label: 'run as root' },
  { pattern: /\b(npm|pnpm|yarn)\s+(install|i|add|uninstall|remove|rm)\b/, label: 'change dependencies' },
  { pattern: /\bcurl\b[^|;&]*\|\s*(ba|z)?sh\b/, label: 'pipe the internet into a shell' },
  { pattern: /\.env\b/, label: 'touch env/credential files' },
];

/** A Bash command is auto-allowed only if EVERY chained segment matches one of these. */
const SAFE_BASH: RegExp[] = [
  /^git (status|diff|log|show|branch)\b/,
  /^(npm|pnpm|yarn) (test|run)\b/,
  /^npx (vitest|jest|tsc|eslint|prettier|next|playwright)\b/,
  /^(ls|pwd|cat|head|tail|wc|grep|rg|find|echo|which|node|tsc)\b/,
];

function isInsideRepo(filePath: string, repoRoot: string): boolean {
  const resolved = path.resolve(repoRoot, filePath);
  return resolved === repoRoot || resolved.startsWith(repoRoot + path.sep);
}

function evaluateBash(command: string): PolicyDecision {
  for (const { pattern, label } of RISKY_BASH) {
    if (pattern.test(command)) {
      return { action: 'ask', reason: `wants to ${label}:\n\`${command}\`` };
    }
  }
  const segments = command
    .split(/&&|\|\||;|\|/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const allSafe = segments.length > 0 && segments.every((segment) => SAFE_BASH.some((re) => re.test(segment)));
  if (allSafe) return { action: 'allow' };
  return { action: 'ask', reason: `wants to run an unrecognized command:\n\`${command}\`` };
}

export function evaluateToolUse(
  toolName: string,
  input: Record<string, unknown>,
  repoRoot: string,
): PolicyDecision {
  if (READ_ONLY_TOOLS.has(toolName)) return { action: 'allow' };

  if (FILE_WRITE_TOOLS.has(toolName)) {
    const filePath = String(input.file_path ?? input.notebook_path ?? '');
    if (/\.env(\.|$)/.test(path.basename(filePath)) && !filePath.endsWith('.env.example')) {
      return { action: 'ask', reason: `wants to write an env file:\n\`${filePath}\`` };
    }
    if (isInsideRepo(filePath, repoRoot)) return { action: 'allow' };
    return { action: 'ask', reason: `wants to write OUTSIDE the repo:\n\`${filePath}\`` };
  }

  if (toolName === 'Bash') return evaluateBash(String(input.command ?? ''));

  if (toolName === 'ExitPlanMode') {
    return { action: 'ask', reason: `proposes this plan:\n\n${String(input.plan ?? '(no plan text)')}` };
  }

  return { action: 'ask', reason: `wants to use tool "${toolName}" (not in the allowlist)` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/policy.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` — expected: no errors.

```bash
git add tools/telegram-bridge/src/policy.ts tools/telegram-bridge/src/policy.test.ts
git commit -m "feat(telegram-bridge): add big-steps approval policy"
```

---

### Task 3: `approvals.ts` — pending-approval broker with timeout

**Files:**
- Create: `tools/telegram-bridge/src/approvals.ts`
- Test: `tools/telegram-bridge/src/approvals.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `class ApprovalBroker { constructor(timeoutMs: number); request(id: string): Promise<boolean>; resolve(id: string, approved: boolean): boolean }` — used by Tasks 4 and 5.

- [ ] **Step 1: Write the failing tests**

Create `tools/telegram-bridge/src/approvals.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalBroker } from './approvals.js';

describe('ApprovalBroker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves true when approved', async () => {
    const broker = new ApprovalBroker(1000);
    const pending = broker.request('a');
    expect(broker.resolve('a', true)).toBe(true);
    await expect(pending).resolves.toBe(true);
  });

  it('resolves false when denied', async () => {
    const broker = new ApprovalBroker(1000);
    const pending = broker.request('a');
    broker.resolve('a', false);
    await expect(pending).resolves.toBe(false);
  });

  it('resolves false after the timeout', async () => {
    const broker = new ApprovalBroker(1000);
    const pending = broker.request('a');
    vi.advanceTimersByTime(1001);
    await expect(pending).resolves.toBe(false);
  });

  it('returns false when resolving an unknown or already-resolved id', () => {
    const broker = new ApprovalBroker(1000);
    expect(broker.resolve('nope', true)).toBe(false);
    void broker.request('a');
    broker.resolve('a', true);
    expect(broker.resolve('a', true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/approvals.test.ts`
Expected: FAIL — `Cannot find module './approvals.js'`.

- [ ] **Step 3: Implement `approvals.ts`**

Create `tools/telegram-bridge/src/approvals.ts`:

```ts
/** Tracks approval requests awaiting a Telegram button tap.
 * Unanswered requests resolve to false (deny) after timeoutMs. */
export class ApprovalBroker {
  private pending = new Map<string, (approved: boolean) => void>();

  constructor(private timeoutMs: number) {}

  request(id: string): Promise<boolean> {
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolvePromise(false);
      }, this.timeoutMs);
      this.pending.set(id, (approved) => {
        clearTimeout(timer);
        this.pending.delete(id);
        resolvePromise(approved);
      });
    });
  }

  /** Returns false if the id is unknown (expired or already answered). */
  resolve(id: string, approved: boolean): boolean {
    const settle = this.pending.get(id);
    if (!settle) return false;
    settle(approved);
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/approvals.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/telegram-bridge/src/approvals.ts tools/telegram-bridge/src/approvals.test.ts
git commit -m "feat(telegram-bridge): add approval broker with 1h deny-on-timeout"
```

---

### Task 4: `session.ts` — Claude Agent SDK wrapper

**Files:**
- Create: `tools/telegram-bridge/src/session.ts`

**Interfaces:**
- Consumes: `evaluateToolUse` (Task 2), `ApprovalBroker` (Task 3), `extractText` (Task 1).
- Produces: `interface SessionEvents { onText(text: string): Promise<void>; onApprovalRequest(id: string, description: string): Promise<void>; onTurnEnd(summary: string): Promise<void> }` and `class ClaudeSession { constructor(repoRoot: string, broker: ApprovalBroker, events: SessionEvents); busy: boolean; send(prompt: string): Promise<void>; interrupt(): Promise<void>; reset(): void }` — used by Task 5.

This task is integration glue around the SDK; its verification is `npm run typecheck` plus the end-to-end check in Task 6. The pure logic it depends on was tested in Tasks 1–3.

- [ ] **Step 1: Implement `session.ts`**

Create `tools/telegram-bridge/src/session.ts`:

```ts
import { randomUUID } from 'node:crypto';
import {
  query,
  type PermissionResult,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { ApprovalBroker } from './approvals.js';
import { extractText } from './format.js';
import { evaluateToolUse } from './policy.js';

export interface SessionEvents {
  onText(text: string): Promise<void>;
  onApprovalRequest(id: string, description: string): Promise<void>;
  onTurnEnd(summary: string): Promise<void>;
}

/** One resumable Claude Code session pinned to the repo root.
 * Streaming-input mode is required for canUseTool and interrupt(). */
export class ClaudeSession {
  busy = false;
  private sessionId: string | undefined;
  private active: Query | undefined;

  constructor(
    private repoRoot: string,
    private broker: ApprovalBroker,
    private events: SessionEvents,
  ) {}

  /** Forget the session id so the next send() starts fresh. */
  reset(): void {
    this.sessionId = undefined;
  }

  async interrupt(): Promise<void> {
    await this.active?.interrupt();
  }

  async send(prompt: string): Promise<void> {
    this.busy = true;
    try {
      const q = query({
        prompt: this.singleMessage(prompt),
        options: {
          cwd: this.repoRoot,
          resume: this.sessionId,
          systemPrompt: { type: 'preset', preset: 'claude_code' },
          settingSources: ['project'],
          permissionMode: 'default',
          canUseTool: (toolName, input) => this.decide(toolName, input),
        },
      });
      this.active = q;
      for await (const message of q) {
        await this.handle(message);
      }
    } finally {
      this.active = undefined;
      this.busy = false;
    }
  }

  private async *singleMessage(prompt: string): AsyncGenerator<SDKUserMessage> {
    yield {
      type: 'user',
      message: { role: 'user', content: prompt },
      parent_tool_use_id: null,
      session_id: this.sessionId ?? '',
    };
  }

  private async decide(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<PermissionResult> {
    const decision = evaluateToolUse(toolName, input, this.repoRoot);
    if (decision.action === 'allow') {
      return { behavior: 'allow', updatedInput: input };
    }
    const id = randomUUID();
    await this.events.onApprovalRequest(id, decision.reason);
    const approved = await this.broker.request(id);
    return approved
      ? { behavior: 'allow', updatedInput: input }
      : { behavior: 'deny', message: 'Denied by the user via Telegram.' };
  }

  private async handle(message: SDKMessage): Promise<void> {
    if (message.type === 'system' && message.subtype === 'init') {
      this.sessionId = message.session_id;
      return;
    }
    if (message.type === 'assistant') {
      const text = extractText(message.message.content as Array<{ type: string; text?: string }>);
      if (text.trim().length > 0) await this.events.onText(text);
      return;
    }
    if (message.type === 'result') {
      this.sessionId = message.session_id;
      const minutes = (message.duration_ms / 60_000).toFixed(1);
      const summary =
        message.subtype === 'success'
          ? `✅ Turn finished in ${minutes} min.`
          : `⚠️ Turn ended early (${message.subtype}) after ${minutes} min.`;
      await this.events.onTurnEnd(summary);
    }
  }
}
```

Note for the implementer: exact SDK type names (`SDKMessage`, `SDKUserMessage`, `PermissionResult`, `Query`) are from `@anthropic-ai/claude-agent-sdk`'s TypeScript exports. If `npm run typecheck` reports a name mismatch with the installed SDK version, open `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (or the package's `types` entry) and use the equivalent exported names — the message shapes (`type: 'system' | 'assistant' | 'result'`, `canUseTool` returning allow/deny) are stable.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite (regression check)**

Run: `npm test`
Expected: PASS — format, policy, approvals suites all green.

- [ ] **Step 4: Commit**

```bash
git add tools/telegram-bridge/src/session.ts
git commit -m "feat(telegram-bridge): add Claude Agent SDK session wrapper"
```

---

### Task 5: `bot.ts` + `main.ts` — Telegram wiring and startup

**Files:**
- Create: `tools/telegram-bridge/src/bot.ts`
- Create: `tools/telegram-bridge/src/main.ts`
- Create: `tools/telegram-bridge/.env.example`

**Interfaces:**
- Consumes: `chunkMessage` (Task 1), `ApprovalBroker` (Task 3), `ClaudeSession` + `SessionEvents` (Task 4).
- Produces: `createBot(config: { token: string; userId: number; repoRoot: string }): Bot` (grammY `Bot`); `main.ts` is the process entry point for `npm start`.

- [ ] **Step 1: Implement `bot.ts`**

Create `tools/telegram-bridge/src/bot.ts`:

```ts
import { Bot, InlineKeyboard } from 'grammy';
import { ApprovalBroker } from './approvals.js';
import { chunkMessage } from './format.js';
import { ClaudeSession } from './session.js';

const APPROVAL_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour, per spec

export function createBot(config: { token: string; userId: number; repoRoot: string }): Bot {
  const bot = new Bot(config.token);

  // Only the configured user may interact; everyone else is silently ignored.
  bot.use(async (ctx, next) => {
    if (ctx.from?.id === config.userId) await next();
  });

  const send = async (text: string): Promise<void> => {
    for (const chunk of chunkMessage(text)) {
      await bot.api.sendMessage(config.userId, chunk);
    }
  };

  const broker = new ApprovalBroker(APPROVAL_TIMEOUT_MS);
  const session = new ClaudeSession(config.repoRoot, broker, {
    onText: send,
    onApprovalRequest: async (id, description) => {
      const keyboard = new InlineKeyboard()
        .text('✅ Go ahead', `approve:${id}`)
        .text('❌ Stop', `deny:${id}`);
      // Send all chunks in order; the buttons go on the LAST message so they
      // sit directly under the end of the description.
      const chunks = chunkMessage(`🤖 Claude ${description}`);
      const last = chunks.pop() ?? '🤖 Claude requests approval';
      for (const chunk of chunks) await bot.api.sendMessage(config.userId, chunk);
      await bot.api.sendMessage(config.userId, last, { reply_markup: keyboard });
    },
    onTurnEnd: send,
  });

  const queue: string[] = [];
  const runTurn = async (prompt: string): Promise<void> => {
    try {
      await session.send(prompt);
    } catch (error) {
      await send(`💥 Session error: ${error instanceof Error ? error.message : String(error)}`);
    }
    const next = queue.shift();
    if (next !== undefined) void runTurn(next);
  };

  bot.command('new', async (ctx) => {
    session.reset();
    await ctx.reply('🆕 Fresh session. Send me a task.');
  });

  bot.command('stop', async (ctx) => {
    if (!session.busy) {
      await ctx.reply('💤 Nothing running.');
      return;
    }
    await session.interrupt();
    await ctx.reply('🛑 Interrupted.');
  });

  bot.command('status', async (ctx) => {
    await ctx.reply(session.busy ? '⏳ Working on the current task…' : '💤 Idle — send me a task.');
  });

  bot.on('callback_query:data', async (ctx) => {
    const [verb, id] = ctx.callbackQuery.data.split(':');
    const approved = verb === 'approve';
    const known = broker.resolve(id ?? '', approved);
    await ctx.answerCallbackQuery({
      text: known ? (approved ? 'Approved ✅' : 'Denied ❌') : 'Expired — already resolved.',
    });
    await ctx.editMessageReplyMarkup(); // remove the buttons
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    if (session.busy) {
      queue.push(text);
      await ctx.reply('📥 Queued — I will get to it after the current turn.');
      return;
    }
    await ctx.reply('🏃 On it…');
    void runTurn(text);
  });

  return bot;
}
```

- [ ] **Step 2: Implement `main.ts` and `.env.example`**

Create `tools/telegram-bridge/src/main.ts`:

```ts
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBot } from './bot.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const userId = Number(process.env.TELEGRAM_USER_ID);

if (!token || !Number.isFinite(userId) || userId <= 0) {
  console.error(
    'Missing config: set TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID in tools/telegram-bridge/.env (see .env.example).',
  );
  process.exit(1);
}

// src/main.ts → telegram-bridge → tools → repo root
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const bot = createBot({ token, userId, repoRoot });
bot.catch((error) => console.error('[telegram-bridge] bot error:', error));

console.log(`[telegram-bridge] up — repo: ${repoRoot}`);
void bot.start();
```

Create `tools/telegram-bridge/.env.example`:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_USER_ID=
```

- [ ] **Step 3: Typecheck and run tests**

Run: `npm run typecheck` — expected: no errors.
Run: `npm test` — expected: all suites PASS.

- [ ] **Step 4: Smoke-test startup validation**

Run (from `tools/telegram-bridge/`, with no `.env` present): `npm start`
Expected: prints the `Missing config` error and exits with code 1. This proves the env guard works without needing real credentials yet.

- [ ] **Step 5: Commit**

```bash
git add tools/telegram-bridge/src/bot.ts tools/telegram-bridge/src/main.ts tools/telegram-bridge/.env.example
git commit -m "feat(telegram-bridge): add Telegram bot wiring and entry point"
```

---

### Task 6: Setup docs, launchd keep-alive, and end-to-end verification

**Files:**
- Create: `tools/telegram-bridge/README.md`
- Create: `tools/telegram-bridge/com.andrey.telegram-bridge.plist`

**Interfaces:**
- Consumes: the running daemon from Task 5.
- Produces: operator documentation and the launchd unit; no code interfaces.

- [ ] **Step 1: Write `README.md`**

Create `tools/telegram-bridge/README.md`:

````markdown
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
Risky actions (commits, pushes, deletes, installs) show ✅/❌ buttons;
unanswered approvals auto-deny after 1 hour.

## Keep it running (launchd)

```bash
cp com.andrey.telegram-bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.andrey.telegram-bridge.plist
```

Starts at login and restarts on crash. Logs: `/tmp/telegram-bridge.log`.
To stop: `launchctl unload ~/Library/LaunchAgents/com.andrey.telegram-bridge.plist`.
Note: the Mac must be awake; this survives reboots, not sleep.
````

- [ ] **Step 2: Write the launchd plist**

Create `tools/telegram-bridge/com.andrey.telegram-bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.andrey.telegram-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "/Users/andrey/Desktop/Marketing Tool/tools/telegram-bridge" &amp;&amp; npm start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/telegram-bridge.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/telegram-bridge.log</string>
</dict>
</plist>
```

- [ ] **Step 3: Manual end-to-end verification (requires the user's phone)**

With `.env` filled in, run `npm start`, then from the phone verify each:

1. `/status` → replies "💤 Idle — send me a task."
2. Send `Read CLAUDE.md and summarize this project in two sentences.` → progress text arrives, then "✅ Turn finished…". No approval prompt (read-only).
3. Send `Run git status and tell me what's changed.` → completes without approval (safe command).
4. Send `Create a file named BRIDGE_TEST.md containing "hello", then commit it.` → file write happens silently; the **commit** triggers ✅/❌ buttons. Tap ✅ → commit happens; summary arrives.
5. Send `Delete BRIDGE_TEST.md and commit the deletion.` → `rm` (or equivalent) triggers buttons; tap ❌ → Claude reports it was denied and stops. Then clean up manually: `git checkout BRIDGE_TEST.md` deletion or approve a follow-up.
6. From a second Telegram account (or ask a friend): message the bot → no response at all (auth guard).
7. `/stop` during a running task → "🛑 Interrupted."

Expected: all seven behave as described. Fix anything that doesn't before committing.

- [ ] **Step 4: Commit**

```bash
git add tools/telegram-bridge/README.md tools/telegram-bridge/com.andrey.telegram-bridge.plist
git commit -m "docs(telegram-bridge): add setup guide and launchd keep-alive unit"
```

---

## Post-plan checks

- Spec coverage: architecture/files (Tasks 1–5), approval policy incl. default-ask (Task 2), 1h timeout deny (Task 3), streaming/resume/chunked output (Tasks 1, 4, 5), commands `/new` `/stop` `/status` + queueing (Task 5), user-ID guard (Task 5, verified Task 6.3), launchd restart (Task 6), secrets via `.env.example` (Task 5), unit tests for policy/format + manual E2E (Tasks 1, 2, 6).
- Out of scope (per spec): multi-project, multi-user, VPS, voice/files.
