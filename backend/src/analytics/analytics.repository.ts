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
