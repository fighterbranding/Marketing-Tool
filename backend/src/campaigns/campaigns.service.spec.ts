jest.mock('./campaigns.repository', () => ({
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
import { CampaignsService } from './campaigns.service';
import { CampaignsRepository } from './campaigns.repository';
import { MetaClientService } from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let repo: {
    findActiveConnection: jest.Mock;
    create: jest.Mock;
    findAllByClient: jest.Mock;
    findOneScoped: jest.Mock;
    updateStatus: jest.Mock;
  };
  let metaClient: {
    createCampaign: jest.Mock;
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

  beforeEach(async () => {
    repo = {
      findActiveConnection: jest.fn(),
      create: jest.fn(),
      findAllByClient: jest.fn(),
      findOneScoped: jest.fn(),
      updateStatus: jest.fn(),
    };
    metaClient = { createCampaign: jest.fn(), updateObjectStatus: jest.fn() };
    encryption = { decrypt: jest.fn().mockReturnValue('decrypted-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: CampaignsRepository, useValue: repo },
        { provide: MetaClientService, useValue: metaClient },
        { provide: TokenEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(CampaignsService);
  });

  describe('create', () => {
    it('creates the campaign via Meta, then persists it locally', async () => {
      repo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.createCampaign.mockResolvedValue({ id: 'meta-123' });
      repo.create.mockResolvedValue({
        id: 'db-1',
        metaCampaignId: 'meta-123',
        name: 'Sale',
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        createdAt: new Date(),
      });

      const result = await service.create('client-1', {
        name: 'Sale',
        objective: 'OUTCOME_SALES',
        specialAdCategories: [],
      });

      expect(encryption.decrypt).toHaveBeenCalledWith('enc', 'iv', 'tag');
      expect(metaClient.createCampaign).toHaveBeenCalledWith(
        'act-1',
        'decrypted-token',
        {
          name: 'Sale',
          objective: 'OUTCOME_SALES',
          specialAdCategories: [],
        },
      );
      expect(repo.create).toHaveBeenCalledWith(
        'client-1',
        'meta-123',
        'Sale',
        'OUTCOME_SALES',
      );
      expect(result.status).toBe('PAUSED');
    });

    it('rejects when the client has no active Meta connection', async () => {
      repo.findActiveConnection.mockResolvedValue(null);

      await expect(
        service.create('client-1', {
          name: 'Sale',
          objective: 'OUTCOME_SALES',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metaClient.createCampaign).not.toHaveBeenCalled();
    });

    it('rejects when the active connection has no ad account id yet', async () => {
      repo.findActiveConnection.mockResolvedValue({
        ...activeConn,
        adAccountId: null,
      });

      await expect(
        service.create('client-1', {
          name: 'Sale',
          objective: 'OUTCOME_SALES',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(metaClient.createCampaign).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('updates on Meta then locally, for a campaign owned by the requesting client', async () => {
      repo.findOneScoped.mockResolvedValue({
        id: 'db-1',
        metaCampaignId: 'meta-123',
        name: 'Sale',
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        createdAt: new Date(),
      });
      repo.findActiveConnection.mockResolvedValue(activeConn);
      repo.updateStatus.mockResolvedValue({ id: 'db-1', status: 'ACTIVE' });

      const result = await service.updateStatus('client-1', 'db-1', 'ACTIVE');

      expect(repo.findOneScoped).toHaveBeenCalledWith('client-1', 'db-1');
      expect(metaClient.updateObjectStatus).toHaveBeenCalledWith(
        'meta-123',
        'decrypted-token',
        'ACTIVE',
      );
      expect(repo.updateStatus).toHaveBeenCalledWith('db-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('throws NotFoundException for a campaign outside the requesting client scope', async () => {
      repo.findOneScoped.mockResolvedValue(null);

      await expect(
        service.updateStatus('client-1', 'someone-elses-campaign', 'ACTIVE'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(metaClient.updateObjectStatus).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('delegates to the repository', async () => {
      repo.findAllByClient.mockResolvedValue([]);

      const result = await service.list('client-1');

      expect(repo.findAllByClient).toHaveBeenCalledWith('client-1');
      expect(result).toEqual([]);
    });
  });
});
