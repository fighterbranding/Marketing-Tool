jest.mock('./ads.repository', () => ({
  AdsRepository: class MockAdsRepository {},
}));
jest.mock('../campaigns/campaigns.repository', () => ({
  CampaignsRepository: class MockCampaignsRepository {},
}));
jest.mock('../ad-sets/ad-sets.repository', () => ({
  AdSetsRepository: class MockAdSetsRepository {},
}));
jest.mock('../meta-client/meta-client.service', () => ({
  MetaClientService: class MockMetaClientService {},
}));
jest.mock('../auth/token-encryption.service', () => ({
  TokenEncryptionService: class MockTokenEncryptionService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsRepository } from './ads.repository';
import { CampaignsRepository } from '../campaigns/campaigns.repository';
import { AdSetsRepository } from '../ad-sets/ad-sets.repository';
import { MetaClientService } from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';

describe('AdsService', () => {
  let service: AdsService;
  let repo: {
    create: jest.Mock;
    findAllByAdSet: jest.Mock;
    findOneScoped: jest.Mock;
    updateStatus: jest.Mock;
  };
  let campaignsRepo: {
    findOneScoped: jest.Mock;
    findActiveConnection: jest.Mock;
  };
  let adSetsRepo: { findOneScoped: jest.Mock };
  let metaClient: {
    uploadImage: jest.Mock;
    createAdCreative: jest.Mock;
    createAd: jest.Mock;
    updateObjectStatus: jest.Mock;
  };
  let encryption: { decrypt: jest.Mock };

  const activeConn = {
    id: 'conn-1',
    adAccountId: 'act-1',
    encryptedToken: 'enc',
    encryptionIv: 'iv',
    encryptionTag: 'tag',
  };

  const campaign = { id: 'camp-1', metaCampaignId: 'meta-camp-1' };
  const adSet = { id: 'adset-1', metaAdSetId: 'meta-adset-1' };

  const dto = {
    name: 'Summer sale ad',
    headline: 'Big sale',
    bodyText: 'Everything must go',
    ctaType: 'SHOP_NOW' as const,
    destinationUrl: 'https://example.com',
    pageId: 'page-1',
  };
  const file = { buffer: Buffer.from('fake'), originalname: 'photo.jpg' };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findAllByAdSet: jest.fn(),
      findOneScoped: jest.fn(),
      updateStatus: jest.fn(),
    };
    campaignsRepo = {
      findOneScoped: jest.fn(),
      findActiveConnection: jest.fn(),
    };
    adSetsRepo = { findOneScoped: jest.fn() };
    metaClient = {
      uploadImage: jest.fn(),
      createAdCreative: jest.fn(),
      createAd: jest.fn(),
      updateObjectStatus: jest.fn(),
    };
    encryption = { decrypt: jest.fn().mockReturnValue('decrypted-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdsService,
        { provide: AdsRepository, useValue: repo },
        { provide: CampaignsRepository, useValue: campaignsRepo },
        { provide: AdSetsRepository, useValue: adSetsRepo },
        { provide: MetaClientService, useValue: metaClient },
        { provide: TokenEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(AdsService);
  });

  describe('create', () => {
    it('chains uploadImage -> createAdCreative -> createAd, then persists locally', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      adSetsRepo.findOneScoped.mockResolvedValue(adSet);
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.uploadImage.mockResolvedValue({ hash: 'img-hash' });
      metaClient.createAdCreative.mockResolvedValue({ id: 'creative-1' });
      metaClient.createAd.mockResolvedValue({ id: 'meta-ad-1' });
      repo.create.mockResolvedValue({
        id: 'db-1',
        metaAdId: 'meta-ad-1',
        status: 'PAUSED',
      });

      const result = await service.create(
        'client-1',
        'camp-1',
        'adset-1',
        dto,
        file,
      );

      expect(metaClient.uploadImage).toHaveBeenCalledWith(
        'act-1',
        'decrypted-token',
        file,
      );
      expect(metaClient.createAdCreative).toHaveBeenCalledWith(
        'act-1',
        'decrypted-token',
        {
          name: 'Summer sale ad creative',
          pageId: 'page-1',
          imageHash: 'img-hash',
          destinationUrl: 'https://example.com',
          headline: 'Big sale',
          bodyText: 'Everything must go',
          ctaType: 'SHOP_NOW',
        },
      );
      expect(metaClient.createAd).toHaveBeenCalledWith(
        'act-1',
        'decrypted-token',
        {
          name: 'Summer sale ad',
          metaAdSetId: 'meta-adset-1',
          creativeId: 'creative-1',
        },
      );
      expect(repo.create).toHaveBeenCalledWith('adset-1', 'meta-ad-1', {
        name: 'Summer sale ad',
        headline: 'Big sale',
        bodyText: 'Everything must go',
        ctaType: 'SHOP_NOW',
        destinationUrl: 'https://example.com',
        imageHash: 'img-hash',
      });
      expect(result.status).toBe('PAUSED');
    });

    it('rejects when no image file was uploaded', async () => {
      await expect(
        service.create('client-1', 'camp-1', 'adset-1', dto, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(campaignsRepo.findOneScoped).not.toHaveBeenCalled();
      expect(metaClient.uploadImage).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the campaign is outside the requesting client scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.create(
          'client-1',
          'someone-elses-campaign',
          'adset-1',
          dto,
          file,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.uploadImage).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the ad set is outside the campaign scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      adSetsRepo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.create('client-1', 'camp-1', 'someone-elses-adset', dto, file),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.uploadImage).not.toHaveBeenCalled();
    });

    it('rejects when the client has no active Meta connection', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      adSetsRepo.findOneScoped.mockResolvedValue(adSet);
      campaignsRepo.findActiveConnection.mockResolvedValue(null);

      await expect(
        service.create('client-1', 'camp-1', 'adset-1', dto, file),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metaClient.uploadImage).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('updates on Meta then locally for an ad owned by the requesting client', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      adSetsRepo.findOneScoped.mockResolvedValue(adSet);
      repo.findOneScoped.mockResolvedValue({
        id: 'ad-1',
        metaAdId: 'meta-ad-1',
      });
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);
      repo.updateStatus.mockResolvedValue({ id: 'ad-1', status: 'ACTIVE' });

      const result = await service.updateStatus(
        'client-1',
        'camp-1',
        'adset-1',
        'ad-1',
        'ACTIVE',
      );

      expect(metaClient.updateObjectStatus).toHaveBeenCalledWith(
        'meta-ad-1',
        'decrypted-token',
        'ACTIVE',
      );
      expect(repo.updateStatus).toHaveBeenCalledWith('ad-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('throws NotFoundException for an ad outside the ad set scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      adSetsRepo.findOneScoped.mockResolvedValue(adSet);
      repo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'client-1',
          'camp-1',
          'adset-1',
          'someone-elses-ad',
          'ACTIVE',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.updateObjectStatus).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('verifies campaign and ad set ownership before delegating to the repository', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      adSetsRepo.findOneScoped.mockResolvedValue(adSet);
      repo.findAllByAdSet.mockResolvedValue([]);

      const result = await service.list('client-1', 'camp-1', 'adset-1');

      expect(campaignsRepo.findOneScoped).toHaveBeenCalledWith(
        'client-1',
        'camp-1',
      );
      expect(adSetsRepo.findOneScoped).toHaveBeenCalledWith(
        'camp-1',
        'adset-1',
      );
      expect(repo.findAllByAdSet).toHaveBeenCalledWith('adset-1');
      expect(result).toEqual([]);
    });
  });
});
