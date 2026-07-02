import { Injectable } from '@nestjs/common';

export interface InsightRow {
  campaignId: string;
  impressions: number;
  reach: number;
  spend_cents: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpm_cents: number;
  cpc_cents: number;
}

@Injectable()
export class MetaClientService {
  async getInsights(_adAccountId: string, _token: string): Promise<InsightRow[]> {
    return [
      {
        campaignId: 'mock-001',
        impressions: 100,
        reach: 80,
        spend_cents: 500,
        clicks: 5,
        conversions: 1,
        ctr: 0.05,
        cpm_cents: 50,
        cpc_cents: 100,
      },
    ];
  }
}
