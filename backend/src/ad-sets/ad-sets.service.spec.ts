jest.mock('./ad-sets.repository', () => ({
  AdSetsRepository: class MockAdSetsRepository {},
}));
jest.mock('../campaigns/campaigns.repository', () => ({
  CampaignsRepository: class MockCampaignsRepository {},
}));
jest.mock('../meta-client/meta-client.service', () => ({
  MetaClientService: class MockMetaClientService {},
}));
jest.mock('../auth/token-encryption.service', () => ({
  TokenEncryptionService: class MockTokenEncryptionService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdSetsService } from './ad-sets.service';
import { AdSetsRepository } from './ad-sets.repository';
import { CampaignsRepository } from '../campaigns/campaigns.repository';
import { MetaClientService } from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import type { TargetingSpec } from '../meta-client/meta-client.service';

describe('AdSetsService', () => {
  let service: AdSetsService;
  let repo: {
    create: jest.Mock;
    findAllByCampaign: jest.Mock;
    findOneScoped: jest.Mock;
    updateStatus: jest.Mock;
    updateFields: jest.Mock;
    delete: jest.Mock;
  };
  let campaignsRepo: {
    findOneScoped: jest.Mock;
    findActiveConnection: jest.Mock;
  };
  let metaClient: {
    createAdSet: jest.Mock;
    updateObjectStatus: jest.Mock;
    updateAdSet: jest.Mock;
    deleteObject: jest.Mock;
    searchTargeting: jest.Mock;
  };
  let encryption: { decrypt: jest.Mock };

  const activeConn = {
    id: 'conn-1',
    adAccountId: 'act-1',
    encryptedToken: 'enc',
    encryptionIv: 'iv',
    encryptionTag: 'tag',
  };

  const targeting: TargetingSpec = {
    countries: ['US'],
    ageMin: 18,
    ageMax: 65,
    platforms: ['facebook', 'instagram'],
    interests: [{ id: '6003107902433', name: 'Fitness' }],
  };

  const campaign = {
    id: 'camp-1',
    metaCampaignId: 'meta-camp-1',
    name: 'Sale',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findAllByCampaign: jest.fn(),
      findOneScoped: jest.fn(),
      updateStatus: jest.fn(),
      updateFields: jest.fn(),
      delete: jest.fn(),
    };
    campaignsRepo = {
      findOneScoped: jest.fn(),
      findActiveConnection: jest.fn(),
    };
    metaClient = {
      createAdSet: jest.fn(),
      updateObjectStatus: jest.fn(),
      updateAdSet: jest.fn(),
      deleteObject: jest.fn(),
      searchTargeting: jest.fn(),
    };
    encryption = { decrypt: jest.fn().mockReturnValue('decrypted-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdSetsService,
        { provide: AdSetsRepository, useValue: repo },
        { provide: CampaignsRepository, useValue: campaignsRepo },
        { provide: MetaClientService, useValue: metaClient },
        { provide: TokenEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(AdSetsService);
  });

  describe('create', () => {
    it('creates the ad set via Meta using the parent campaign metaCampaignId, then persists locally', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.createAdSet.mockResolvedValue({ id: 'meta-adset-1' });
      repo.create.mockResolvedValue({
        id: 'db-1',
        metaAdSetId: 'meta-adset-1',
        name: 'Warm audience',
        dailyBudgetCents: 2000,
        optimizationGoal: 'LINK_CLICKS',
        targeting,
        status: 'PAUSED',
        createdAt: new Date(),
      });

      const result = await service.create('client-1', 'camp-1', {
        name: 'Warm audience',
        dailyBudgetCents: 2000,
        optimizationGoal: 'LINK_CLICKS',
        targeting,
      });

      expect(campaignsRepo.findOneScoped).toHaveBeenCalledWith(
        'client-1',
        'camp-1',
      );
      expect(metaClient.createAdSet).toHaveBeenCalledWith(
        'act-1',
        'decrypted-token',
        {
          name: 'Warm audience',
          metaCampaignId: 'meta-camp-1',
          dailyBudgetCents: 2000,
          optimizationGoal: 'LINK_CLICKS',
          targeting,
        },
      );
      expect(repo.create).toHaveBeenCalledWith(
        'camp-1',
        'meta-adset-1',
        'Warm audience',
        2000,
        'LINK_CLICKS',
        targeting,
      );
      expect(result.status).toBe('PAUSED');
    });

    it('throws NotFoundException when the campaign is outside the requesting client scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.create('client-1', 'someone-elses-campaign', {
          name: 'Warm audience',
          dailyBudgetCents: 2000,
          optimizationGoal: 'LINK_CLICKS',
          targeting,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.createAdSet).not.toHaveBeenCalled();
    });

    it('rejects when the client has no active Meta connection', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      campaignsRepo.findActiveConnection.mockResolvedValue(null);

      await expect(
        service.create('client-1', 'camp-1', {
          name: 'Warm audience',
          dailyBudgetCents: 2000,
          optimizationGoal: 'LINK_CLICKS',
          targeting,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metaClient.createAdSet).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('updates on Meta then locally for an ad set owned by the requesting client', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findOneScoped.mockResolvedValue({
        id: 'adset-1',
        metaAdSetId: 'meta-adset-1',
        name: 'Warm audience',
        dailyBudgetCents: 2000,
        optimizationGoal: 'LINK_CLICKS',
        targeting,
        status: 'PAUSED',
        createdAt: new Date(),
      });
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);
      repo.updateStatus.mockResolvedValue({ id: 'adset-1', status: 'ACTIVE' });

      const result = await service.updateStatus(
        'client-1',
        'camp-1',
        'adset-1',
        'ACTIVE',
      );

      expect(metaClient.updateObjectStatus).toHaveBeenCalledWith(
        'meta-adset-1',
        'decrypted-token',
        'ACTIVE',
      );
      expect(repo.updateStatus).toHaveBeenCalledWith('adset-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('throws NotFoundException for an ad set outside the campaign scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'client-1',
          'camp-1',
          'someone-elses-adset',
          'ACTIVE',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.updateObjectStatus).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates on Meta then locally for an ad set owned by the requesting client', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findOneScoped.mockResolvedValue({
        id: 'adset-1',
        metaAdSetId: 'meta-adset-1',
        name: 'Warm audience',
        dailyBudgetCents: 2000,
        optimizationGoal: 'LINK_CLICKS',
        targeting,
        status: 'PAUSED',
        createdAt: new Date(),
      });
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);
      repo.updateFields.mockResolvedValue({ id: 'adset-1', name: 'Renamed' });

      const result = await service.update('client-1', 'camp-1', 'adset-1', {
        name: 'Renamed',
        dailyBudgetCents: 4000,
        optimizationGoal: 'REACH',
        targeting,
      });

      expect(metaClient.updateAdSet).toHaveBeenCalledWith(
        'meta-adset-1',
        'decrypted-token',
        {
          name: 'Renamed',
          dailyBudgetCents: 4000,
          optimizationGoal: 'REACH',
          targeting,
        },
      );
      expect(repo.updateFields).toHaveBeenCalledWith(
        'adset-1',
        'Renamed',
        4000,
        'REACH',
        targeting,
      );
      expect(result.name).toBe('Renamed');
    });

    it('throws NotFoundException for an ad set outside the campaign scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.update('client-1', 'camp-1', 'someone-elses-adset', {
          name: 'Renamed',
          dailyBudgetCents: 4000,
          optimizationGoal: 'REACH',
          targeting,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.updateAdSet).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes on Meta then locally for an ad set owned by the requesting client', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findOneScoped.mockResolvedValue({
        id: 'adset-1',
        metaAdSetId: 'meta-adset-1',
        name: 'Warm audience',
        dailyBudgetCents: 2000,
        optimizationGoal: 'LINK_CLICKS',
        targeting,
        status: 'PAUSED',
        createdAt: new Date(),
      });
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);

      await service.delete('client-1', 'camp-1', 'adset-1');

      expect(metaClient.deleteObject).toHaveBeenCalledWith(
        'meta-adset-1',
        'decrypted-token',
      );
      expect(repo.delete).toHaveBeenCalledWith('adset-1');
    });

    it('throws NotFoundException for an ad set outside the campaign scope', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.delete('client-1', 'camp-1', 'someone-elses-adset'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.deleteObject).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('verifies campaign ownership before delegating to the repository', async () => {
      campaignsRepo.findOneScoped.mockResolvedValue(campaign);
      repo.findAllByCampaign.mockResolvedValue([]);

      const result = await service.list('client-1', 'camp-1');

      expect(campaignsRepo.findOneScoped).toHaveBeenCalledWith(
        'client-1',
        'camp-1',
      );
      expect(repo.findAllByCampaign).toHaveBeenCalledWith('camp-1');
      expect(result).toEqual([]);
    });
  });

  describe('searchTargeting', () => {
    it('short-circuits queries shorter than 2 characters without calling Meta', async () => {
      const result = await service.searchTargeting('client-1', 'f');

      expect(result).toEqual([]);
      expect(campaignsRepo.findActiveConnection).not.toHaveBeenCalled();
      expect(metaClient.searchTargeting).not.toHaveBeenCalled();
    });

    it('proxies the search to Meta using the client active connection token', async () => {
      campaignsRepo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.searchTargeting.mockResolvedValue([
        { id: '6003107902433', name: 'Fitness', audienceSize: 50000000 },
      ]);

      const result = await service.searchTargeting('client-1', 'fitness');

      expect(metaClient.searchTargeting).toHaveBeenCalledWith(
        'fitness',
        'decrypted-token',
      );
      expect(result).toEqual([
        { id: '6003107902433', name: 'Fitness', audienceSize: 50000000 },
      ]);
    });
  });
});
