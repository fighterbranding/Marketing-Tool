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

export type CampaignObjective =
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_SALES'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_AWARENESS';

export type CampaignStatus = 'ACTIVE' | 'PAUSED';

export interface Campaign {
  id: string;
  metaCampaignId: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  createdAt: string;
}

export type OptimizationGoal =
  | 'LINK_CLICKS'
  | 'REACH'
  | 'IMPRESSIONS'
  | 'OFFSITE_CONVERSIONS';

export interface TargetingInterest {
  id: string;
  name: string;
}

export interface TargetingSpec {
  countries: string[];
  ageMin: number;
  ageMax: number;
  platforms: string[];
  interests: TargetingInterest[];
}

export interface AdSet {
  id: string;
  metaAdSetId: string;
  name: string;
  dailyBudgetCents: number;
  optimizationGoal: OptimizationGoal;
  targeting: TargetingSpec;
  status: CampaignStatus;
  createdAt: string;
}

export interface TargetingSuggestion {
  id: string;
  name: string;
  audienceSize?: number;
}

export type CtaType = 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'DOWNLOAD' | 'CONTACT_US';

export interface Ad {
  id: string;
  metaAdId: string;
  name: string;
  headline: string;
  bodyText: string;
  ctaType: CtaType;
  destinationUrl: string;
  imageHash: string;
  status: CampaignStatus;
  createdAt: string;
}

export interface InstagramAccount {
  id: string;
  username: string;
  profilePictureUrl?: string;
}

export interface Page {
  id: string;
  name: string;
  instagramAccount?: InstagramAccount;
}

export interface Business {
  id: string;
  name: string;
}

export type AdAccountStatus = 'ACTIVE' | 'DISABLED' | 'UNSETTLED' | 'PENDING_REVIEW' | 'OTHER';

export interface AdAccount {
  id: string;
  name: string;
  status: AdAccountStatus;
  currency: string;
  timezoneName: string;
}

export interface CurrentAdAccountSelection {
  businessId: string | null;
  adAccountId: string | null;
}
