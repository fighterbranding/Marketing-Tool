import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetaClientService } from '../meta-client/meta-client.service';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { TokenEncryptionService } from '../auth/token-encryption.service';

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
    private readonly encryption: TokenEncryptionService,
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

    // No ad account selected yet means there's nothing to sync — skip
    // rather than retry, since retrying can't fix a missing selection.
    if (!conn || conn.status !== 'ACTIVE' || !conn.adAccountId) return;

    try {
      const token = this.encryption.decrypt(
        conn.encryptedToken,
        conn.encryptionIv,
        conn.encryptionTag,
      );
      const insights = await this.metaClient.getInsights(
        conn.adAccountId,
        token,
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
