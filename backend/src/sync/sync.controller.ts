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
