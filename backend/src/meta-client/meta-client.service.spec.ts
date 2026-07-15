jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), delete: jest.fn() },
  isAxiosError: jest.fn(),
}));

import axios, { isAxiosError } from 'axios';
import { MetaClientService } from './meta-client.service';

describe('MetaClientService', () => {
  let service: MetaClientService;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- referencing the mock fn, never calling it unbound
  const mockedPost = axios.post as jest.Mock;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- referencing the mock fn, never calling it unbound
  const mockedGet = axios.get as jest.Mock;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- referencing the mock fn, never calling it unbound
  const mockedDelete = axios.delete as jest.Mock;
  const mockedIsAxiosError = isAxiosError as unknown as jest.Mock;

  beforeEach(() => {
    service = new MetaClientService();
    mockedPost.mockReset();
    mockedGet.mockReset();
    mockedDelete.mockReset();
    mockedIsAxiosError.mockReset();
  });

  describe('createCampaign', () => {
    it('always sends status PAUSED and returns the created campaign id', async () => {
      mockedPost.mockResolvedValue({ data: { id: 'camp_123' } });

      const result = await service.createCampaign('act-1', 'token-1', {
        name: 'Summer sale',
        objective: 'OUTCOME_SALES',
        specialAdCategories: [],
      });

      expect(result).toEqual({ id: 'camp_123' });
      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/act_act-1/campaigns',
        expect.objectContaining({
          name: 'Summer sale',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          special_ad_categories: [],
        }),
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });

    it('normalizes a Meta API error response into metaErrorCode', async () => {
      mockedIsAxiosError.mockReturnValue(true);
      mockedPost.mockRejectedValue({
        message: 'Request failed with status code 400',
        response: {
          data: { error: { message: 'Invalid parameter', code: 100 } },
        },
      });

      await expect(
        service.createCampaign('act-1', 'token-1', {
          name: 'Summer sale',
          objective: 'OUTCOME_SALES',
          specialAdCategories: [],
        }),
      ).rejects.toMatchObject({
        message: 'Invalid parameter',
        metaErrorCode: 100,
      });
    });

    it('falls back to the raw error when it is not an Axios error', async () => {
      mockedIsAxiosError.mockReturnValue(false);
      mockedPost.mockRejectedValue(new Error('network timeout'));

      await expect(
        service.createCampaign('act-1', 'token-1', {
          name: 'Summer sale',
          objective: 'OUTCOME_SALES',
          specialAdCategories: [],
        }),
      ).rejects.toThrow('network timeout');
    });
  });

  describe('updateObjectStatus', () => {
    it('posts the status update to the object id (works for campaigns, ad sets, or ads)', async () => {
      mockedPost.mockResolvedValue({ data: {} });

      await service.updateObjectStatus('camp_123', 'token-1', 'ACTIVE');

      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/camp_123',
        { status: 'ACTIVE' },
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('createAdSet', () => {
    it('always sends status PAUSED and maps the targeting spec to Meta field names', async () => {
      mockedPost.mockResolvedValue({ data: { id: 'adset_123' } });

      const result = await service.createAdSet('act-1', 'token-1', {
        name: 'Warm audience',
        metaCampaignId: 'camp_123',
        dailyBudgetCents: 2000,
        optimizationGoal: 'LINK_CLICKS',
        targeting: {
          countries: ['US'],
          ageMin: 18,
          ageMax: 65,
          platforms: ['facebook', 'instagram'],
          interests: [{ id: '6003107902433', name: 'Fitness' }],
        },
      });

      expect(result).toEqual({ id: 'adset_123' });
      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/act_act-1/adsets',
        expect.objectContaining({
          name: 'Warm audience',
          campaign_id: 'camp_123',
          daily_budget: 2000,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          status: 'PAUSED',
          targeting: {
            geo_locations: { countries: ['US'] },
            age_min: 18,
            age_max: 65,
            interests: [{ id: '6003107902433', name: 'Fitness' }],
            publisher_platforms: ['facebook', 'instagram'],
          },
        }),
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('searchTargeting', () => {
    it('queries the adinterest search endpoint and maps results', async () => {
      mockedGet.mockResolvedValue({
        data: {
          data: [
            {
              id: '6003107902433',
              name: 'Fitness',
              audience_size_upper_bound: 50000000,
            },
          ],
        },
      });

      const result = await service.searchTargeting('fitness', 'token-1');

      expect(result).toEqual([
        { id: '6003107902433', name: 'Fitness', audienceSize: 50000000 },
      ]);
      expect(mockedGet).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/search',
        {
          params: { type: 'adinterest', q: 'fitness', limit: 10 },
          headers: { Authorization: 'Bearer token-1' },
        },
      );
    });
  });

  describe('uploadImage', () => {
    it('uploads the file as multipart and returns the image hash', async () => {
      mockedPost.mockResolvedValue({
        data: {
          images: { 'photo.jpg': { hash: 'abc123', url: 'https://...' } },
        },
      });

      const result = await service.uploadImage('act-1', 'token-1', {
        buffer: Buffer.from('fake-image-bytes'),
        originalname: 'photo.jpg',
      });

      expect(result).toEqual({ hash: 'abc123' });
      expect(mockedPost).toHaveBeenCalledTimes(1);
      const [url, , options] = mockedPost.mock.calls[0] as [
        string,
        unknown,
        { headers: { Authorization: string } },
      ];
      expect(url).toBe('https://graph.facebook.com/v21.0/act_act-1/adimages');
      expect(options.headers.Authorization).toBe('Bearer token-1');
    });
  });

  describe('createAdCreative', () => {
    it('builds an object_story_spec with the image hash and copy', async () => {
      mockedPost.mockResolvedValue({ data: { id: 'creative_123' } });

      const result = await service.createAdCreative('act-1', 'token-1', {
        name: 'Summer sale creative',
        pageId: 'page-1',
        imageHash: 'abc123',
        destinationUrl: 'https://example.com',
        headline: 'Big sale',
        bodyText: 'Everything must go',
        ctaType: 'SHOP_NOW',
      });

      expect(result).toEqual({ id: 'creative_123' });
      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/act_act-1/adcreatives',
        expect.objectContaining({
          name: 'Summer sale creative',
          object_story_spec: {
            page_id: 'page-1',
            link_data: {
              image_hash: 'abc123',
              link: 'https://example.com',
              name: 'Big sale',
              message: 'Everything must go',
              call_to_action: { type: 'SHOP_NOW' },
            },
          },
        }),
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('createAd', () => {
    it('always sends status PAUSED and returns the created ad id', async () => {
      mockedPost.mockResolvedValue({ data: { id: 'ad_123' } });

      const result = await service.createAd('act-1', 'token-1', {
        name: 'Summer sale ad',
        metaAdSetId: 'adset_123',
        creativeId: 'creative_123',
      });

      expect(result).toEqual({ id: 'ad_123' });
      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/act_act-1/ads',
        {
          name: 'Summer sale ad',
          adset_id: 'adset_123',
          creative: { creative_id: 'creative_123' },
          status: 'PAUSED',
        },
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('deleteObject', () => {
    it('sends a DELETE request to the object id (works for campaigns, ad sets, or ads)', async () => {
      mockedDelete.mockResolvedValue({ data: {} });

      await service.deleteObject('camp_123', 'token-1');

      expect(mockedDelete).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/camp_123',
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('updateCampaign', () => {
    it('only sends the name (objective is immutable on Meta)', async () => {
      mockedPost.mockResolvedValue({ data: {} });

      await service.updateCampaign('camp_123', 'token-1', { name: 'Renamed' });

      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/camp_123',
        { name: 'Renamed' },
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('updateAdSet', () => {
    it('sends name, budget, optimization goal, and mapped targeting', async () => {
      mockedPost.mockResolvedValue({ data: {} });

      await service.updateAdSet('adset_123', 'token-1', {
        name: 'Renamed audience',
        dailyBudgetCents: 3000,
        optimizationGoal: 'REACH',
        targeting: {
          countries: ['CA'],
          ageMin: 21,
          ageMax: 55,
          platforms: ['facebook'],
          interests: [],
        },
      });

      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/adset_123',
        {
          name: 'Renamed audience',
          daily_budget: 3000,
          optimization_goal: 'REACH',
          targeting: {
            geo_locations: { countries: ['CA'] },
            age_min: 21,
            age_max: 55,
            interests: [],
            publisher_platforms: ['facebook'],
          },
        },
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });

  describe('updateAd', () => {
    it('only sends the name (creative is immutable post-creation)', async () => {
      mockedPost.mockResolvedValue({ data: {} });

      await service.updateAd('ad_123', 'token-1', { name: 'Renamed ad' });

      expect(mockedPost).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/ad_123',
        { name: 'Renamed ad' },
        { headers: { Authorization: 'Bearer token-1' } },
      );
    });
  });
});
