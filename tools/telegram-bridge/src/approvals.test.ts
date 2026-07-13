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

  it('denies a duplicate request for an already-pending id without clobbering the original', async () => {
    const broker = new ApprovalBroker(1000);
    const first = broker.request('a');
    const second = broker.request('a');

    vi.advanceTimersByTime(0);
    await expect(second).resolves.toBe(false);

    expect(broker.resolve('a', true)).toBe(true);
    await expect(first).resolves.toBe(true);
  });
});
