import { Injectable } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import FormData from 'form-data';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// Meta's `actions` field mixes true conversions (purchases, leads, signups)
// with top-of-funnel engagement that isn't a conversion by any objective's
// definition. Excluding these avoids counting every link click as a
// "conversion" — it's not a substitute for real per-objective mapping, but
// summing everything unfiltered is unconditionally wrong.
const NON_CONVERSION_ACTION_TYPES = new Set([
  'link_click',
  'post_engagement',
  'page_engagement',
  'post_reaction',
  'comment',
  'post',
  'like',
  'video_view',
  'landing_page_view',
  'photo_view',
]);

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

export interface CreateCampaignInput {
  name: string;
  objective: string;
  specialAdCategories: string[];
}

export interface MetaCampaign {
  id: string;
}

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

export interface CreateAdSetInput {
  name: string;
  metaCampaignId: string;
  dailyBudgetCents: number;
  optimizationGoal: string;
  targeting: TargetingSpec;
}

export interface MetaAdSet {
  id: string;
}

export interface TargetingSuggestion {
  id: string;
  name: string;
  audienceSize?: number;
}

export type ObjectStatus = 'ACTIVE' | 'PAUSED';

export interface UploadedImage {
  hash: string;
}

export interface CreateAdCreativeInput {
  name: string;
  pageId: string;
  imageHash: string;
  destinationUrl: string;
  headline: string;
  bodyText: string;
  ctaType: string;
}

export interface MetaCreative {
  id: string;
}

export interface CreateAdInput {
  name: string;
  metaAdSetId: string;
  creativeId: string;
}

export interface MetaAd {
  id: string;
}

export interface UpdateCampaignInput {
  name: string;
}

export interface UpdateAdSetInput {
  name: string;
  dailyBudgetCents: number;
  optimizationGoal: string;
  targeting: TargetingSpec;
}

export interface UpdateAdInput {
  name: string;
}

export interface MetaInstagramAccount {
  id: string;
  username: string;
  profilePictureUrl?: string;
}

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  instagramAccount?: MetaInstagramAccount;
}

export interface MetaBusiness {
  id: string;
  name: string;
}

export type AdAccountStatus =
  'ACTIVE' | 'DISABLED' | 'UNSETTLED' | 'PENDING_REVIEW' | 'OTHER';

export interface MetaAdAccount {
  id: string;
  name: string;
  status: AdAccountStatus;
  currency: string;
  timezoneName: string;
}

// Meta's numeric account_status codes — see
// docs/03-meta-api/business-manager-api.md. Only 1 (active) is usable;
// anything else should block campaign creation with a clear reason.
const AD_ACCOUNT_STATUS_MAP: Record<number, AdAccountStatus> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_REVIEW',
};

@Injectable()
export class MetaClientService {
  async getInsights(adAccountId: string, token: string): Promise<InsightRow[]> {
    try {
      const res = await axios.get<{
        data: {
          campaign_id: string;
          impressions?: string;
          reach?: string;
          spend?: string;
          clicks?: string;
          actions?: { action_type: string; value: string }[];
          ctr?: string;
          cpm?: string;
          cpc?: string;
        }[];
      }>(`${GRAPH_API_BASE}/act_${adAccountId}/insights`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          level: 'campaign',
          fields:
            'campaign_id,impressions,reach,spend,clicks,actions,ctr,cpm,cpc',
          date_preset: 'today',
        },
      });
      return res.data.data.map((row) => ({
        campaignId: row.campaign_id,
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        spend_cents: Math.round(Number(row.spend ?? 0) * 100),
        clicks: Number(row.clicks ?? 0),
        conversions: (row.actions ?? [])
          .filter((a) => !NON_CONVERSION_ACTION_TYPES.has(a.action_type))
          .reduce((sum, a) => sum + Number(a.value ?? 0), 0),
        // Meta returns ctr/cpm/cpc as percentage/dollar strings; normalize
        // ctr to a fraction and cpm/cpc to cents to match our stored units.
        ctr: Number(row.ctr ?? 0) / 100,
        cpm_cents: Math.round(Number(row.cpm ?? 0) * 100),
        cpc_cents: Math.round(Number(row.cpc ?? 0) * 100),
      }));
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async createCampaign(
    adAccountId: string,
    token: string,
    data: CreateCampaignInput,
  ): Promise<MetaCampaign> {
    try {
      const res = await axios.post<{ id: string }>(
        `${GRAPH_API_BASE}/act_${adAccountId}/campaigns`,
        {
          name: data.name,
          objective: data.objective,
          // Always created paused — the client must explicitly launch. See docs/03-meta-api/marketing-api.md.
          status: 'PAUSED',
          special_ad_categories: data.specialAdCategories,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { id: res.data.id };
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async createAdSet(
    adAccountId: string,
    token: string,
    data: CreateAdSetInput,
  ): Promise<MetaAdSet> {
    try {
      const res = await axios.post<{ id: string }>(
        `${GRAPH_API_BASE}/act_${adAccountId}/adsets`,
        {
          name: data.name,
          campaign_id: data.metaCampaignId,
          daily_budget: data.dailyBudgetCents,
          billing_event: 'IMPRESSIONS',
          optimization_goal: data.optimizationGoal,
          targeting: {
            geo_locations: { countries: data.targeting.countries },
            age_min: data.targeting.ageMin,
            age_max: data.targeting.ageMax,
            interests: data.targeting.interests.map((i) => ({
              id: i.id,
              name: i.name,
            })),
            publisher_platforms: data.targeting.platforms,
          },
          // Always created paused — the client must explicitly launch. See docs/03-meta-api/marketing-api.md.
          status: 'PAUSED',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { id: res.data.id };
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async searchTargeting(
    query: string,
    token: string,
  ): Promise<TargetingSuggestion[]> {
    try {
      const res = await axios.get<{
        data: {
          id: string;
          name: string;
          audience_size_upper_bound?: number;
        }[];
      }>(`${GRAPH_API_BASE}/search`, {
        params: { type: 'adinterest', q: query, limit: 10 },
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.data.map((row) => ({
        id: row.id,
        name: row.name,
        audienceSize: row.audience_size_upper_bound,
      }));
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async uploadImage(
    adAccountId: string,
    token: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<UploadedImage> {
    try {
      const form = new FormData();
      form.append(file.originalname, file.buffer, file.originalname);
      const res = await axios.post<{
        images: Record<string, { hash: string }>;
      }>(`${GRAPH_API_BASE}/act_${adAccountId}/adimages`, form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });
      const uploaded = Object.values(res.data.images)[0];
      return { hash: uploaded.hash };
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async createAdCreative(
    adAccountId: string,
    token: string,
    data: CreateAdCreativeInput,
  ): Promise<MetaCreative> {
    try {
      const res = await axios.post<{ id: string }>(
        `${GRAPH_API_BASE}/act_${adAccountId}/adcreatives`,
        {
          name: data.name,
          object_story_spec: {
            page_id: data.pageId,
            link_data: {
              image_hash: data.imageHash,
              link: data.destinationUrl,
              name: data.headline,
              message: data.bodyText,
              call_to_action: { type: data.ctaType },
            },
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { id: res.data.id };
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async createAd(
    adAccountId: string,
    token: string,
    data: CreateAdInput,
  ): Promise<MetaAd> {
    try {
      const res = await axios.post<{ id: string }>(
        `${GRAPH_API_BASE}/act_${adAccountId}/ads`,
        {
          name: data.name,
          adset_id: data.metaAdSetId,
          creative: { creative_id: data.creativeId },
          // Always created paused — the client must explicitly launch. See docs/03-meta-api/marketing-api.md.
          status: 'PAUSED',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { id: res.data.id };
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  // Campaigns, ad sets, and ads all share this same status-update pattern —
  // the object id alone determines which level is being updated. See
  // docs/03-meta-api/marketing-api.md section 4.
  async updateObjectStatus(
    metaObjectId: string,
    token: string,
    status: ObjectStatus,
  ): Promise<void> {
    try {
      await axios.post(
        `${GRAPH_API_BASE}/${metaObjectId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  // Campaigns, ad sets, and ads all share this same delete pattern too.
  async deleteObject(metaObjectId: string, token: string): Promise<void> {
    try {
      await axios.delete(`${GRAPH_API_BASE}/${metaObjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  // Objective is immutable on Meta's side once a campaign is created, so
  // only name is editable here.
  async updateCampaign(
    metaCampaignId: string,
    token: string,
    data: UpdateCampaignInput,
  ): Promise<void> {
    try {
      await axios.post(
        `${GRAPH_API_BASE}/${metaCampaignId}`,
        { name: data.name },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async updateAdSet(
    metaAdSetId: string,
    token: string,
    data: UpdateAdSetInput,
  ): Promise<void> {
    try {
      await axios.post(
        `${GRAPH_API_BASE}/${metaAdSetId}`,
        {
          name: data.name,
          daily_budget: data.dailyBudgetCents,
          optimization_goal: data.optimizationGoal,
          targeting: {
            geo_locations: { countries: data.targeting.countries },
            age_min: data.targeting.ageMin,
            age_max: data.targeting.ageMax,
            interests: data.targeting.interests.map((i) => ({
              id: i.id,
              name: i.name,
            })),
            publisher_platforms: data.targeting.platforms,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  // The ad creative (image/copy) is immutable on Meta's side once created —
  // changing creative content means creating a new creative and pointing
  // the ad at it, out of scope here. Only the ad's own name is editable.
  async updateAd(
    metaAdId: string,
    token: string,
    data: UpdateAdInput,
  ): Promise<void> {
    try {
      await axios.post(
        `${GRAPH_API_BASE}/${metaAdId}`,
        { name: data.name },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  // Instagram is only reachable through a linked Page, not independently —
  // requesting instagram_business_account as a sub-object here (rather than
  // a second call per page) gets the linked account's details in one round
  // trip. See docs/03-meta-api/pages-api.md.
  async getPages(token: string): Promise<MetaPage[]> {
    try {
      const res = await axios.get<{
        data: {
          id: string;
          name: string;
          access_token: string;
          instagram_business_account?: {
            id: string;
            username: string;
            profile_picture_url?: string;
          };
        }[];
      }>(`${GRAPH_API_BASE}/me/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          fields:
            'id,name,access_token,instagram_business_account{id,username,profile_picture_url}',
        },
      });
      return res.data.data.map((page) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        instagramAccount: page.instagram_business_account
          ? {
              id: page.instagram_business_account.id,
              username: page.instagram_business_account.username,
              profilePictureUrl:
                page.instagram_business_account.profile_picture_url,
            }
          : undefined,
      }));
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async getBusinesses(token: string): Promise<MetaBusiness[]> {
    try {
      const res = await axios.get<{ data: { id: string; name: string }[] }>(
        `${GRAPH_API_BASE}/me/businesses`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data.data.map((b) => ({ id: b.id, name: b.name }));
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  async getAdAccounts(
    businessId: string,
    token: string,
  ): Promise<MetaAdAccount[]> {
    try {
      const res = await axios.get<{
        data: {
          id: string;
          name: string;
          account_status: number;
          currency: string;
          timezone_name: string;
        }[];
      }>(`${GRAPH_API_BASE}/${businessId}/owned_ad_accounts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { fields: 'id,name,account_status,currency,timezone_name' },
      });
      return res.data.data.map((a) => ({
        // Meta's ad account ids come back prefixed with "act_" from this
        // endpoint; strip it so it matches the bare id used everywhere else
        // (e.g. act_${adAccountId} when building campaign/adset URLs).
        id: a.id.replace(/^act_/, ''),
        name: a.name,
        status: AD_ACCOUNT_STATUS_MAP[a.account_status] ?? 'OTHER',
        currency: a.currency,
        timezoneName: a.timezone_name,
      }));
    } catch (err) {
      throw this.toMetaError(err);
    }
  }

  // Confirms the token actually has access to this specific ad account
  // before we save it as the client's selection — avoids a wall of opaque
  // permission errors on every subsequent campaign/insights call. See
  // docs/03-meta-api/business-manager-api.md section 3.
  async verifyAdAccountAccess(
    adAccountId: string,
    token: string,
  ): Promise<boolean> {
    try {
      await axios.get(`${GRAPH_API_BASE}/act_${adAccountId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { fields: 'id' },
      });
      return true;
    } catch {
      return false;
    }
  }

  private toMetaError(err: unknown): Error & { metaErrorCode?: number } {
    if (isAxiosError(err)) {
      const responseData = err.response?.data as
        { error?: { message?: string; code?: number } } | undefined;
      const metaError = responseData?.error;
      const mapped: Error & { metaErrorCode?: number } = new Error(
        metaError?.message ?? err.message,
      );
      mapped.metaErrorCode = metaError?.code;
      return mapped;
    }
    return err instanceof Error ? err : new Error('Unknown Meta API error');
  }
}
