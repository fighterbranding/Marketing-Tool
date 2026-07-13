import path from 'node:path';

export type PolicyDecision = { action: 'allow' } | { action: 'ask'; reason: string };

/** Tools that never change anything: always allowed, silently. */
const READ_ONLY_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite',
  'NotebookRead', 'BashOutput', 'TaskList', 'TaskGet',
]);

/** Tools that write files — allowed only inside the repo, never on env/credential files. */
const FILE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/** Any match anywhere in a Bash command → ask. Checked before the safe list. */
const RISKY_BASH: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /[<>`]|\$\(/, label: 'run a command with redirection or substitution' },
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

/**
 * True when the path is a Claude settings file the SDK auto-loads
 * (`.claude/settings.json`, `.claude/settings.local.json`, `.claude/settings.*.json`).
 * Writing these can silently grant new `permissions.allow` rules that bypass this
 * policy on the next turn, so they're gated for approval even though they're
 * otherwise a plain in-repo write.
 */
function isClaudeSettingsFile(filePath: string, repoRoot: string): boolean {
  const resolved = path.resolve(repoRoot, filePath);
  const relative = path.relative(repoRoot, resolved);
  const segments = relative.split(path.sep);
  const inClaudeDir = segments.slice(0, -1).includes('.claude');
  if (!inClaudeDir) return false;
  return /^settings(\..*)?\.json$/.test(path.basename(resolved));
}

/**
 * Conservative allowlist of characters the SAFE_BASH commands legitimately need,
 * plus the separators we explicitly split on below (`;`, `|`, newline, carriage
 * return, and the paired `&&` chain operator).
 *
 * A bare `&` is deliberately NOT in this set. `&&` pairs are stripped before this
 * check runs, so a lone `&` (bash's async/background operator) always fails
 * closed — smuggling a risky command behind a safe one via `&` can't be caught
 * by per-segment matching alone, since backgrounding detaches execution from the
 * part of the command line the segment matcher can see.
 *
 * This is the fail-closed half of the fix: any character outside this set (a
 * forgotten operator, a unicode lookalike, a stray `\0`, ...) is rejected here
 * instead of silently falling through to segment-by-segment matching.
 */
const ALLOWED_BASH_CHARS = /^[A-Za-z0-9\s\-_./=:,'"@+~^%[\]{}?*#!;|]*$/;

function evaluateBash(command: string): PolicyDecision {
  for (const { pattern, label } of RISKY_BASH) {
    if (pattern.test(command)) {
      return { action: 'ask', reason: `wants to ${label}:\n\`${command}\`` };
    }
  }
  if (!ALLOWED_BASH_CHARS.test(command.replace(/&&/g, ''))) {
    return {
      action: 'ask',
      reason: `wants to run a command with an unrecognized operator or character:\n\`${command}\``,
    };
  }
  const segments = command
    .split(/&&|\|\||;|\||\n|\r|&/)
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
    if (filePath.trim() === '') {
      return { action: 'ask', reason: 'wants to write a file but no path was given' };
    }
    if (/\.env(\.|$)/.test(path.basename(filePath)) && !filePath.endsWith('.env.example')) {
      return { action: 'ask', reason: `wants to write an env file:\n\`${filePath}\`` };
    }
    if (isClaudeSettingsFile(filePath, repoRoot)) {
      return { action: 'ask', reason: `wants to change Claude's own permission settings: ${filePath}` };
    }
    if (isInsideRepo(filePath, repoRoot)) return { action: 'allow' };
    return { action: 'ask', reason: `wants to write OUTSIDE the repo:\n\`${filePath}\`` };
  }

  if (toolName === 'Bash') return evaluateBash(String(input.command ?? ''));

  if (toolName === 'ExitPlanMode') {
    return { action: 'ask', reason: `proposes this plan:\n\n${String(input.plan ?? '(no plan text)')}` };
  }

  if (toolName === 'Task') {
    const description = String(input.description ?? '').trim();
    const prompt = String(input.prompt ?? '').trim();
    const what = description || prompt || '(no description given)';
    return { action: 'ask', reason: `wants to start a helper sub-agent to: ${what}` };
  }

  return { action: 'ask', reason: `wants to use tool "${toolName}" (not in the allowlist)` };
}
