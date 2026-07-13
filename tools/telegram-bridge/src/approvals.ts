/** Tracks approval requests awaiting a Telegram button tap.
 * Unanswered requests resolve to false (deny) after timeoutMs. */
export class ApprovalBroker {
  private pending = new Map<string, (approved: boolean) => void>();

  constructor(private timeoutMs: number) {}

  request(id: string): Promise<boolean> {
    // Fail closed: never clobber a genuinely in-flight request. A duplicate
    // id means something is wrong upstream, so deny it without touching the
    // original's timer/resolver.
    if (this.pending.has(id)) {
      return Promise.resolve(false);
    }
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
