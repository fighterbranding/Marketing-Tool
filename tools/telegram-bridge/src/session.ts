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
      session_id: this.sessionId,
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
      const text = extractText(
        message.message.content as Array<{ type: string; text?: string }>,
      );
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
