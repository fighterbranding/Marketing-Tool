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
