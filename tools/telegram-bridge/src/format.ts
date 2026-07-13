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
