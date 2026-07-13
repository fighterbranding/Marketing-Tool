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
