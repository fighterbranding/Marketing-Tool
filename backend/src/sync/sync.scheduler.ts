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
