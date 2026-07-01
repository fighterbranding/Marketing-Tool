# Cache

## Overview

Redis serving three purposes in this platform: session/JWT blacklist storage, short-lived caching of expensive Meta API responses, and as the backing store for BullMQ (see [job-queue.md](job-queue.md)). One Redis instance can serve all three in early stages — split into separate instances only if you hit contention at scale.

## Setup

```typescript
// cache.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({ url: process.env.REDIS_URL, ttl: 60000 }),
      }),
    }),
  ],
})
export class CacheModule {}
```

## What to cache

**Insights API responses** for short windows (e.g. 5 minutes) when multiple users might view the same client's dashboard close together — avoids redundant Meta API calls within that window.

```typescript
async getCachedInsights(cacheKey: string, fetchFn: () => Promise<any>) {
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached;
  const fresh = await fetchFn();
  await this.cacheManager.set(cacheKey, fresh, 300000); // 5 min
  return fresh;
}
```

**Targeting search results** (interests, behaviors, demographics lookup for the campaign creation UI) — this data changes infrequently, cache for hours not minutes.

**What NOT to cache**: access tokens themselves. Keep those in the encrypted Postgres store as the source of truth — Redis should only ever hold a short-lived in-memory decrypted token during active request processing, never persisted there.

## JWT session handling

If you implement logout/token revocation, store a blacklist of revoked JWT IDs in Redis with a TTL matching the token's remaining expiry, and check it in your auth guard.

## Estimated time

1 day for setup and the basic caching wrapper.
