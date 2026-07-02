export interface InsightsSummary {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface DailyPoint {
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface InsightsResponse {
  summary: InsightsSummary;
  daily: DailyPoint[];
}

export interface InsightsData {
  current: InsightsResponse;
  previous: InsightsResponse;
}
