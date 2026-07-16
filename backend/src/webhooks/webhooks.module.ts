import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksProcessor } from './webhooks.processor';
import { DEFAULT_QUEUE_JOB_OPTIONS } from '../common/queue-default-job-options';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'meta-webhooks',
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksProcessor],
})
export class WebhooksModule {}
