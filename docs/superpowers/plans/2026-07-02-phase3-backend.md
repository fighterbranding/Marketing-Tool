# Phase 3 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the sync engine, analytics store, and API endpoint that pull Meta ad metrics into TimescaleDB and serve them to the frontend dashboard.

**Architecture:** MetaClientService (stubbed) is called by SyncProcessor (BullMQ) on a 15-min cron schedule. Metrics are upserted into a TimescaleDB hypertable via raw SQL. AnalyticsController reads aggregated daily data from that table and returns it to the frontend.

**Tech Stack:** NestJS 11, @nestjs/bullmq, bullmq, @nestjs/schedule, Prisma 7 ($queryRaw / $executeRaw), TimescaleDB (raw SQL migration), Jest + @nestjs/testing

## Global Constraints

- Node 20, TypeScript strict mode
- All Prisma access via `this.prisma.db` (see PrismaService)
- JWT guard: `JwtAuthGuard` from `src/common/guards/jwt-auth.guard.ts`
- Client scope guard: `ClientScopeGuard` from `src/common/guards/client-scope.guard.ts` — sets `req.clientId` from JWT payload
- No `any` types except where Prisma raw query results require casting
- `spend_cents`, `cpm_cents`, `cpc_cents` stored as integers (cents) in DB; divided by 100 in the API response
- Commit after every task

---

## File Map

**Create:**
- `backend/prisma/timescale.sql` — one-time hypertable setup script
- `backend/src/meta-client/meta-client.module.ts`
- `backend/src/meta-client/meta-client.service.ts` — stubbed, returns mock data
- `backend/src/sync/sync.module.ts`
- `backend/src/sync/sync.scheduler.ts` — cron trigger
- `backend/src/sync/sync.processor.ts` — BullMQ job handler
- `backend/src/sync/sync.controller.ts` — manual trigger endpoint
- `backend/src/sync/sync.processor.spec.ts`
- `backend/src/analytics/analytics.module.ts`
- `backend/src/analytics/analytics.repository.ts`
- `backend/src/analytics/analytics.service.ts`
- `backend/src/analytics/analytics.controller.ts`
- `backend/src/analytics/analytics.repository.spec.ts`

**Modify:**
- `backend/package.json` — add `@nestjs/bullmq`, `bullmq`, `@nestjs/schedule`
- `backend/src/app.module.ts` — add `BullModule.forRoot`, `ScheduleModule.forRoot`, new modules

---

## Task 1: Install dependencies + TimescaleDB migration file

**Files:**
- Modify: `backend/package.json`
- Create: `backend/prisma/timescale.sql`

- [ ] **Step 1: Install new packages**

```bash
cd backend && npm install @nestjs/bullmq bullmq @nestjs/schedule
```

Expected: packages added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 2: Create the TimescaleDB migration file**

Create `backend/prisma/timescale.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS campaign_metrics (
  time                   TIMESTAMPTZ     NOT NULL,
  client_id              UUID            NOT NULL,
  campaign_id            TEXT            NOT NULL,
  impressions            BIGINT          DEFAULT 0,
  reach                  BIGINT          DEFAULT 0,
  spend_cents            BIGINT          DEFAULT 0,
  clicks                 BIGINT          DEFAULT 0,
  conversions            BIGINT          DEFAULT 0,
  conversion_value_cents BIGINT          DEFAULT 0,
  ctr                    NUMERIC(6,4)    DEFAULT 0,
  cpm_cents              BIGINT          DEFAULT 0,
  cpc_cents              BIGINT          DEFAULT 0
);

SELECT create_hypertable('campaign_metrics', 'time', if_not_exists => TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_unique
  ON campaign_metrics (time, client_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_metrics_client_campaign
  ON campaign_metrics (client_id, campaign_id, time DESC);
```

- [ ] **Step 3: Apply the migration (Docker must be running)**

```bash
cd backend && docker exec -i marketing_tool_db psql -U marketing -d marketing_tool < prisma/timescale.sql
```

Expected output includes:
```
CREATE EXTENSION
CREATE TABLE
create_hypertable
...
CREATE INDEX
```

- [ ] **Step 4: Verify the table exists**

```bash
docker exec -it marketing_tool_db psql -U marketing -d marketing_tool -c "\d campaign_metrics"
```

Expected: table columns listed with `time` as the first column.

- [ ] **Step 5: Commit**

```bash
cd backend && git add package.json package-lock.json ../backend/prisma/timescale.sql
git add prisma/timescale.sql
cd .. && git add backend/package.json backend/package-lock.json backend/prisma/timescale.sql
git commit -m "feat: install bullmq/schedule deps and add TimescaleDB migration"
```

---

## Task 2: MetaClientModule (stubbed)

**Files:**
- Create: `backend/src/meta-client/meta-client.module.ts`
- Create: `backend/src/meta-client/meta-client.service.ts`

**Interfaces:**
- Produces: `InsightRow` type, `MetaClientService.getInsights(adAccountId: string, token: string): Promise<InsightRow[]>`

- [ ] **Step 1: Create `meta-client.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';

export interface InsightRow {
  campaignId: string;
  impressions: number;
  reach: number;
  spend_cents: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpm_cents: number;
  cpc_cents: number;
}

@Injectable()
export class MetaClientService {
  async getInsights(_adAccountId: string, _token: string): Promise<InsightRow[]> {
    return [
      {
        campaignId: 'mock-001',
        impressions: 100,
        reach: 80,
        spend_cents: 500,
        clicks: 5,
        conversions: 1,
        ctr: 0.05,
        cpm_cents: 50,
        cpc_cents: 100,
      },
    ];
  }
}
```

- [ ] **Step 2: Create `meta-client.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { MetaClientService } from './meta-client.service';

@Module({
  providers: [MetaClientService],
  exports: [MetaClientService],
})
export class MetaClientModule {}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/andrey/Desktop/Marketing Tool" && git add backend/src/meta-client/
git commit -m "feat: add MetaClientModule with stubbed getInsights"
```

---

## Task 3: SyncModule

**Files:**
- Create: `backend/src/sync/sync.module.ts`
- Create: `backend/src/sync/sync.scheduler.ts`
- Create: `backend/src/sync/sync.processor.ts`
- Create: `backend/src/sync/sync.controller.ts`
- Create: `backend/src/sync/sync.processor.spec.ts`

**Interfaces:**
- Consumes: `MetaClientService.getInsights` (from Task 2), `AnalyticsRepository.upsertMetrics` (from Task 4 — define interface now, implement later)
- Produces: `POST /sync/trigger/:connectionId` → `{ queued: true }`

- [ ] **Step 1: Write the failing test**

Create `backend/src/sync/sync.processor.spec.ts`:

```typescript
jest.mock('bullmq', () => ({
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { SyncProcessor } from './sync.processor';
import { MetaClientService } from '../meta-client/meta-client.service';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { PrismaService } from '../prisma/prisma.service';

const makeJob = (data: { connectionId: string }) =>
  ({ data } as Job<{ connectionId: string }>);

describe('SyncProcessor', () => {
  let processor: SyncProcessor;
  let metaClient: jest.Mocked<MetaClientService>;
  let analyticsRepo: jest.Mocked<AnalyticsRepository>;
  let prismaDb: {
    metaConnection: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaDb = {
      metaConnection: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncProcessor,
        {
          provide: MetaClientService,
          useValue: { getInsights: jest.fn() },
        },
        {
          provide: AnalyticsRepository,
          useValue: { upsertMetrics: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: { db: prismaDb },
        },
      ],
    }).compile();

    processor = module.get(SyncProcessor);
    metaClient = module.get(MetaClientService) as jest.Mocked<MetaClientService>;
    analyticsRepo = module.get(AnalyticsRepository) as jest.Mocked<AnalyticsRepository>;
  });

  it('calls getInsights and upsertMetrics for an active connection', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      clientId: 'client-1',
      adAccountId: '123',
      status: 'ACTIVE',
      encryptedToken: 'enc',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    });
    metaClient.getInsights.mockResolvedValue([
      {
        campaignId: 'mock-001',
        impressions: 100,
        reach: 80,
        spend_cents: 500,
        clicks: 5,
        conversions: 1,
        ctr: 0.05,
        cpm_cents: 50,
        cpc_cents: 100,
      },
    ]);

    await processor.process(makeJob({ connectionId: 'conn-1' }));

    expect(metaClient.getInsights).toHaveBeenCalledWith('123', 'enc');
    expect(analyticsRepo.upsertMetrics).toHaveBeenCalledWith(
      'client-1',
      'mock-001',
      expect.any(Date),
      expect.objectContaining({ impressions: 100, spend_cents: 500 }),
    );
  });

  it('marks connection NEEDS_RECONNECT on Meta error 190 without rethrowing', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      clientId: 'client-1',
      adAccountId: '123',
      status: 'ACTIVE',
      encryptedToken: 'enc',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    });
    const terminalErr = Object.assign(new Error('token expired'), { metaErrorCode: 190 });
    metaClient.getInsights.mockRejectedValue(terminalErr);

    await expect(processor.process(makeJob({ connectionId: 'conn-1' }))).resolves.toBeUndefined();
    expect(prismaDb.metaConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'NEEDS_RECONNECT' },
    });
  });

  it('rethrows non-terminal errors so BullMQ retries', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      clientId: 'client-1',
      adAccountId: '123',
      status: 'ACTIVE',
      encryptedToken: 'enc',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    });
    metaClient.getInsights.mockRejectedValue(new Error('network timeout'));

    await expect(processor.process(makeJob({ connectionId: 'conn-1' }))).rejects.toThrow('network timeout');
  });

  it('skips job if connection is not found', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue(null);

    await expect(processor.process(makeJob({ connectionId: 'gone' }))).resolves.toBeUndefined();
    expect(metaClient.getInsights).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest sync/sync.processor.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './sync.processor'`

- [ ] **Step 3: Create `sync.processor.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetaClientService } from '../meta-client/meta-client.service';
import { AnalyticsRepository } from '../analytics/analytics.repository';

export interface SyncJobData {
  connectionId: string;
}

@Processor('meta-sync')
@Injectable()
export class SyncProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaClientService,
    private readonly analyticsRepo: AnalyticsRepository,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const conn = await this.prisma.db.metaConnection.findUnique({
      where: { id: job.data.connectionId },
      select: {
        id: true,
        clientId: true,
        adAccountId: true,
        status: true,
        encryptedToken: true,
        encryptionIv: true,
        encryptionTag: true,
      },
    });

    if (!conn || conn.status !== 'ACTIVE') return;

    try {
      const insights = await this.metaClient.getInsights(
        conn.adAccountId ?? 'stub',
        conn.encryptedToken,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const row of insights) {
        await this.analyticsRepo.upsertMetrics(conn.clientId, row.campaignId, today, row);
      }
    } catch (err: unknown) {
      const metaErr = err as { metaErrorCode?: number } & Error;
      if (metaErr.metaErrorCode === 190) {
        await this.prisma.db.metaConnection.update({
          where: { id: conn.id },
          data: { status: 'NEEDS_RECONNECT' },
        });
        return;
      }
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest sync/sync.processor.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Create `sync.scheduler.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncScheduler {
  constructor(
    @InjectQueue('meta-sync') private readonly syncQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/15 * * * *')
  async scheduleSyncs(): Promise<void> {
    const connections = await this.prisma.db.metaConnection.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const conn of connections) {
      await this.syncQueue.add(
        'sync-insights',
        { connectionId: conn.id },
        { jobId: `sync-${conn.id}-${Date.now()}` },
      );
    }
  }
}
```

- [ ] **Step 6: Create `sync.controller.ts`**

```typescript
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('sync')
export class SyncController {
  constructor(
    @InjectQueue('meta-sync') private readonly syncQueue: Queue,
  ) {}

  @Post('trigger/:connectionId')
  @UseGuards(JwtAuthGuard)
  async trigger(@Param('connectionId') connectionId: string): Promise<{ queued: boolean }> {
    await this.syncQueue.add(
      'sync-insights',
      { connectionId },
      { jobId: `manual-${connectionId}-${Date.now()}` },
    );
    return { queued: true };
  }
}
```

- [ ] **Step 7: Create `sync.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncProcessor } from './sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { SyncController } from './sync.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'meta-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    }),
    MetaClientModule,
    AnalyticsModule,
  ],
  providers: [SyncProcessor, SyncScheduler],
  controllers: [SyncController],
})
export class SyncModule {}
```

- [ ] **Step 8: Commit**

```bash
cd "/Users/andrey/Desktop/Marketing Tool" && git add backend/src/sync/
git commit -m "feat: add SyncModule with BullMQ processor, cron scheduler, and manual trigger"
```

---

## Task 4: AnalyticsModule

**Files:**
- Create: `backend/src/analytics/analytics.repository.ts`
- Create: `backend/src/analytics/analytics.service.ts`
- Create: `backend/src/analytics/analytics.controller.ts`
- Create: `backend/src/analytics/analytics.module.ts`
- Create: `backend/src/analytics/analytics.repository.spec.ts`

**Interfaces:**
- Consumes: `PrismaService.db.$queryRaw`, `PrismaService.db.$executeRaw`
- Produces:
  - `AnalyticsRepository.upsertMetrics(clientId, campaignId, date, row)` (consumed by SyncProcessor in Task 3)
  - `AnalyticsRepository.getMetrics(clientId, from, to): Promise<DailyMetric[]>`
  - `GET /analytics/insights?clientId=X&from=Y&to=Z` → `InsightsResponse`

- [ ] **Step 1: Write the failing test**

Create `backend/src/analytics/analytics.repository.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsRepository, DailyMetric } from './analytics.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsRepository', () => {
  let repo: AnalyticsRepository;
  let prismaDb: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };

  beforeEach(async () => {
    prismaDb = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(AnalyticsRepository);
  });

  it('returns rows from $queryRaw for getMetrics', async () => {
    const mockRows: DailyMetric[] = [
      {
        day: new Date('2026-06-01'),
        spend: BigInt(5000),
        impressions: BigInt(1000),
        clicks: BigInt(50),
        conversions: BigInt(2),
      },
    ];
    prismaDb.$queryRaw.mockResolvedValue(mockRows);

    const result = await repo.getMetrics(
      'client-1',
      new Date('2026-06-01'),
      new Date('2026-06-30'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].impressions).toBe(BigInt(1000));
    expect(prismaDb.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('calls $executeRaw for upsertMetrics', async () => {
    prismaDb.$executeRaw.mockResolvedValue(1);

    await repo.upsertMetrics('client-1', 'campaign-1', new Date('2026-06-01'), {
      campaignId: 'campaign-1',
      impressions: 100,
      reach: 80,
      spend_cents: 500,
      clicks: 5,
      conversions: 1,
      ctr: 0.05,
      cpm_cents: 50,
      cpc_cents: 100,
    });

    expect(prismaDb.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest analytics/analytics.repository.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './analytics.repository'`

- [ ] **Step 3: Create `analytics.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InsightRow } from '../meta-client/meta-client.service';

export interface DailyMetric {
  day: Date;
  spend: bigint;
  impressions: bigint;
  clicks: bigint;
  conversions: bigint;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(clientId: string, from: Date, to: Date): Promise<DailyMetric[]> {
    return this.prisma.db.$queryRaw<DailyMetric[]>`
      SELECT
        time::date                AS day,
        SUM(spend_cents)          AS spend,
        SUM(impressions)          AS impressions,
        SUM(clicks)               AS clicks,
        SUM(conversions)          AS conversions
      FROM campaign_metrics
      WHERE client_id = ${clientId}::uuid
        AND time >= ${from}
        AND time <  ${to}
      GROUP BY day
      ORDER BY day
    `;
  }

  async upsertMetrics(
    clientId: string,
    campaignId: string,
    date: Date,
    row: InsightRow,
  ): Promise<void> {
    await this.prisma.db.$executeRaw`
      INSERT INTO campaign_metrics
        (time, client_id, campaign_id, impressions, reach, spend_cents, clicks, conversions, ctr, cpm_cents, cpc_cents)
      VALUES
        (${date}, ${clientId}::uuid, ${campaignId}, ${row.impressions}, ${row.reach}, ${row.spend_cents}, ${row.clicks}, ${row.conversions}, ${row.ctr}, ${row.cpm_cents}, ${row.cpc_cents})
      ON CONFLICT (time, client_id, campaign_id) DO UPDATE SET
        impressions = EXCLUDED.impressions,
        reach       = EXCLUDED.reach,
        spend_cents = EXCLUDED.spend_cents,
        clicks      = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        ctr         = EXCLUDED.ctr,
        cpm_cents   = EXCLUDED.cpm_cents,
        cpc_cents   = EXCLUDED.cpc_cents
    `;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest analytics/analytics.repository.spec.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Create `analytics.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AnalyticsRepository, DailyMetric } from './analytics.repository';

interface InsightsSummary {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface DailyPoint {
  day: Date;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface InsightsResponse {
  summary: InsightsSummary;
  daily: DailyPoint[];
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async getInsights(clientId: string, from: Date, to: Date): Promise<InsightsResponse> {
    const rows: DailyMetric[] = await this.repo.getMetrics(clientId, from, to);

    const daily: DailyPoint[] = rows.map((r) => ({
      day: r.day,
      spend: Number(r.spend) / 100,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      conversions: Number(r.conversions),
    }));

    const summary = daily.reduce<InsightsSummary>(
      (acc, r) => ({
        spend: acc.spend + r.spend,
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        conversions: acc.conversions + r.conversions,
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0 },
    );

    return { summary, daily };
  }
}
```

- [ ] **Step 6: Create `analytics.controller.ts`**

```typescript
import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { AnalyticsService, InsightsResponse } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('insights')
  async getInsights(
    @Request() req: { clientId: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<InsightsResponse> {
    return this.analyticsService.getInsights(
      req.clientId,
      new Date(from),
      new Date(to),
    );
  }
}
```

- [ ] **Step 7: Create `analytics.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  providers: [AnalyticsRepository, AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsRepository],
})
export class AnalyticsModule {}
```

- [ ] **Step 8: Commit**

```bash
cd "/Users/andrey/Desktop/Marketing Tool" && git add backend/src/analytics/
git commit -m "feat: add AnalyticsModule with repository, service, and insights endpoint"
```

---

## Task 5: Wire everything into AppModule

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Update `app.module.ts`**

Replace the entire file with:

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { MetaClientModule } from './meta-client/meta-client.module';
import { SyncModule } from './sync/sync.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: 6379,
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    AuthModule,
    MetaClientModule,
    SyncModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 2: Run all tests to confirm nothing broken**

```bash
cd backend && npx jest --no-coverage
```

Expected: all existing tests pass + 6 new tests pass (4 processor + 2 repository).

- [ ] **Step 3: Build to confirm TypeScript compiles**

```bash
cd backend && npm run build
```

Expected: `Successfully compiled` with no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/andrey/Desktop/Marketing Tool" && git add backend/src/app.module.ts
git commit -m "feat: wire BullMQ, ScheduleModule, SyncModule, and AnalyticsModule into AppModule"
```

---

## Smoke Test (manual, with Docker running)

After all tasks complete:

```bash
# Start the backend
cd backend && npm run start:dev

# Trigger a manual sync (replace TOKEN and CONNECTION_ID with real values from DB)
curl -X POST http://localhost:3000/sync/trigger/<CONNECTION_ID> \
  -H "Authorization: Bearer <JWT_TOKEN>"
# Expected: {"queued":true}

# Query analytics
curl "http://localhost:3000/analytics/insights?from=2026-06-01&to=2026-07-01" \
  -H "Authorization: Bearer <JWT_TOKEN>"
# Expected: {"summary":{...},"daily":[...]}
```
