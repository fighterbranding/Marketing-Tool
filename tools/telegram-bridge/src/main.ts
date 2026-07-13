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
