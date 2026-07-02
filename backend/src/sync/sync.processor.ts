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
