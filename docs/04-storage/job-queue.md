# Job queue

## Overview

BullMQ (backed by the same Redis instance) handles all asynchronous work: scheduled Meta syncs, webhook event processing, and report generation. Keeping this separate from your main request/response cycle means slow operations (a multi-second Meta API call, a PDF render) never block a user-facing HTTP request.

## Queues to set up

| Queue name | Used by | Trigger |
|---|---|---|
| `meta-sync` | Sync engine | Cron, every 15 min |
| `token-refresh` | Auth service | Cron, daily |
| `webhook-events` | Webhooks | Incoming webhook POST |
| `report-generation` | Reports | User-triggered from frontend |

## Setup

```typescript
// app.module.ts
import { BullModule } from '@nestjs/bull';

BullModule.forRoot({
  redis: { host: process.env.REDIS_HOST, port: 6379 },
}),
BullModule.registerQueue(
  { name: 'meta-sync' },
  { name: 'token-refresh' },
  { name: 'webhook-events' },
  { name: 'report-generation' },
)
```

## Job options worth setting explicitly

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400 }, // keep completed jobs 1 day for debugging, then clean up
  removeOnFail: { age: 604800 },    // keep failed jobs 7 days — you'll want to investigate these
}
```

## Monitoring

Install `@bull-board/nestjs` to get a web UI for inspecting queue state (pending/active/failed jobs) during development and early production — invaluable for debugging why a particular client's sync isn't running.

```bash
npm i @bull-board/nestjs @bull-board/express
```

## Failure handling pattern

Distinguish between retryable failures (network blip, Meta rate limit) and terminal failures (revoked token, deleted ad account) — don't let BullMQ exhaust retries on something that will never succeed.

```typescript
@Process('sync-insights')
async handleSync(job: Job) {
  try {
    await this.doSync(job.data);
  } catch (err) {
    if (err.metaErrorCode === 190) {
      // terminal: mark connection as needs_reconnect, don't retry
      await this.clientsService.markNeedsReconnect(job.data.connectionId);
      return; // don't rethrow — prevents pointless retries
    }
    throw err; // rethrow for BullMQ's retry/backoff to handle
  }
}
```

## Estimated time

1-2 days for setup, plus the failure-handling pattern above (worth getting right early — it saves a lot of confused debugging later).
