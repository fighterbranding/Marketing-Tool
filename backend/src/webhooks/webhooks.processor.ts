import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('meta-webhooks')
@Injectable()
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  process(job: Job<unknown>): Promise<void> {
    // No subscribed fields are configured in the App Dashboard yet, so
    // there's no defined event-specific handling to build. Log for now —
    // add per-field handling here once real subscriptions are chosen.
    this.logger.log(`Received Meta webhook event: ${JSON.stringify(job.data)}`);
    return Promise.resolve();
  }
}
