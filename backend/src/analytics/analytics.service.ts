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
