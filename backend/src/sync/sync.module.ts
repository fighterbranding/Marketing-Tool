import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncProcessor } from './sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { SyncController } from './sync.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { DEFAULT_QUEUE_JOB_OPTIONS } from '../common/queue-default-job-options';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'meta-sync',
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
    }),
    MetaClientModule,
    AnalyticsModule,
    AuthModule,
  ],
  providers: [SyncProcessor, SyncScheduler],
  controllers: [SyncController],
})
export class SyncModule {}
