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
