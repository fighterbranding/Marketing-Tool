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

function evaluateBash(command: string): PolicyDecision {
  for (const { pattern, label } of RISKY_BASH) {
    if (pattern.test(command)) {
      return { action: 'ask', reason: `wants to ${label}:\n\`${command}\`` };
    }
  }
  const segments = command
    .split(/&&|\|\||;|\||\n/)
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
    if (isInsideRepo(filePath, repoRoot)) return { action: 'allow' };
    return { action: 'ask', reason: `wants to write OUTSIDE the repo:\n\`${filePath}\`` };
  }

  if (toolName === 'Bash') return evaluateBash(String(input.command ?? ''));

  if (toolName === 'ExitPlanMode') {
    return { action: 'ask', reason: `proposes this plan:\n\n${String(input.plan ?? '(no plan text)')}` };
  }

  return { action: 'ask', reason: `wants to use tool "${toolName}" (not in the allowlist)` };
}
