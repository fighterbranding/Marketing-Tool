# Sync engine

## Overview

Scheduled background jobs that pull fresh data from Meta into your own database, so the dashboard reads from fast local storage instead of hitting Meta's API on every page load. Built with BullMQ on top of Redis.

## Why sync instead of live-querying Meta on every request

- Meta's Insights API can be slow for large date ranges (multi-second responses)
- Meta enforces rate limits per ad account — live-querying on every dashboard view will hit them fast with multiple users
- Historical data doesn't change, so there's no reason to refetch it repeatedly

## Implementation steps

### 1. Queue setup

```typescript
// sync.module.ts
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'meta-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
})
export class SyncModule {}
```

### 2. Scheduled trigger

Use `@nestjs/schedule` to enqueue a sync job per client on a cron schedule.

```typescript
@Cron('*/15 * * * *') // every 15 minutes
async scheduleSyncs() {
  const activeConnections = await this.clientsService.getActiveMetaConnections();
  for (const conn of activeConnections) {
    await this.syncQueue.add('sync-insights', { connectionId: conn.id });
  }
}
```

Stagger these rather than firing all at once — add a small random delay per job to avoid bursting Meta's rate limit if you have many clients.

### 3. The job processor

```typescript
@Processor('meta-sync')
export class SyncProcessor {
  @Process('sync-insights')
  async handleSync(job: Job<{ connectionId: string }>) {
    const conn = await this.clientsService.getConnection(job.data.connectionId);
    const token = await this.authService.getValidToken(conn); // handles refresh if needed

    const insights = await this.metaClient.getInsights(conn.adAccountId, token, {
      dateRange: 'last_7d',
      fields: ['impressions', 'reach', 'spend', 'clicks', 'ctr', 'cpm'],
    });

    await this.analyticsStore.upsertMetrics(conn.clientId, insights);
  }
}
```

### 4. Rate limit handling in the shared meta-client

This belongs in the shared `meta-client` module (used by sync, insights, and campaigns alike), not duplicated per module.

```typescript
async callMetaApi(fn: () => Promise<any>, retries = 3): Promise<any> {
  try {
    return await fn();
  } catch (err) {
    if (err.response?.headers?.['x-business-use-case-usage']) {
      const usage = JSON.parse(err.response.headers['x-business-use-case-usage']);
      // back off based on usage percentage approaching 100%
    }
    if (err.response?.status === 429 && retries > 0) {
      await sleep(2000 * (4 - retries));
      return this.callMetaApi(fn, retries - 1);
    }
    throw new MetaApiError(err);
  }
}
```

Meta's rate limits are per ad account, scored on a rolling usage percentage (visible in the `x-business-use-case-usage` response header) rather than a simple request count — checking that header lets you back off proactively instead of waiting to be throttled.

### 5. Incremental sync for large accounts

For clients with long campaign histories, don't refetch all-time data every run. Track a `last_synced_at` timestamp per connection and only pull data since then, except for a less-frequent (e.g. nightly) full reconciliation pass to catch any late-arriving attribution data (Meta's conversion attribution can update retroactively for up to 7 days).

## Estimated time

4-6 days including rate-limit handling, retry logic, and incremental sync.
