jest.mock('./ad-accounts.repository', () => ({
  AdAccountsRepository: class MockAdAccountsRepository {},
}));
jest.mock('../meta-client/meta-client.service', () => ({
  MetaClientService: class MockMetaClientService {},
}));
jest.mock('../auth/token-encryption.service', () => ({
  TokenEncryptionService: class MockTokenEncryptionService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdAccountsService } from './ad-accounts.service';
import { AdAccountsRepository } from './ad-accounts.repository';
import { MetaClientService } from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';

describe('AdAccountsService', () => {
  let service: AdAccountsService;
  let repo: { findActiveConnection: jest.Mock; selectAdAccount: jest.Mock };
  let metaClient: {
    getBusinesses: jest.Mock;
    getAdAccounts: jest.Mock;
    verifyAdAccountAccess: jest.Mock;
  };
  let encryption: { decrypt: jest.Mock };

  const activeConn = {
    id: 'conn-1',
    adAccountId: null,
    businessId: null,
    encryptedToken: 'enc',
    encryptionIv: 'iv',
    encryptionTag: 'tag',
  };

  beforeEach(async () => {
    repo = { findActiveConnection: jest.fn(), selectAdAccount: jest.fn() };
    metaClient = {
      getBusinesses: jest.fn(),
      getAdAccounts: jest.fn(),
      verifyAdAccountAccess: jest.fn(),
    };
    encryption = { decrypt: jest.fn().mockReturnValue('decrypted-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdAccountsService,
        { provide: AdAccountsRepository, useValue: repo },
        { provide: MetaClientService, useValue: metaClient },
        { provide: TokenEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(AdAccountsService);
  });

  describe('listBusinesses', () => {
    it('decrypts the connection token and delegates to Meta', async () => {
      repo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.getBusinesses.mockResolvedValue([
        { id: 'biz_1', name: 'Acme' },
      ]);

      const result = await service.listBusinesses('client-1');

      expect(encryption.decrypt).toHaveBeenCalledWith('enc', 'iv', 'tag');
      expect(metaClient.getBusinesses).toHaveBeenCalledWith('decrypted-token');
      expect(result).toEqual([{ id: 'biz_1', name: 'Acme' }]);
    });

    it('rejects when the client has no active Meta connection', async () => {
      repo.findActiveConnection.mockResolvedValue(null);

      await expect(service.listBusinesses('client-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(metaClient.getBusinesses).not.toHaveBeenCalled();
    });
  });

  describe('listAdAccounts', () => {
    it('passes the businessId through to Meta', async () => {
      repo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.getAdAccounts.mockResolvedValue([]);

      await service.listAdAccounts('client-1', 'biz_1');

      expect(metaClient.getAdAccounts).toHaveBeenCalledWith(
        'biz_1',
        'decrypted-token',
      );
    });
  });

  describe('getCurrentSelection', () => {
    it('returns the connection businessId/adAccountId', async () => {
      repo.findActiveConnection.mockResolvedValue({
        ...activeConn,
        businessId: 'biz_1',
        adAccountId: '123',
      });

      const result = await service.getCurrentSelection('client-1');

      expect(result).toEqual({ businessId: 'biz_1', adAccountId: '123' });
    });
  });

  describe('select', () => {
    it('verifies access then persists the selection', async () => {
      repo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.verifyAdAccountAccess.mockResolvedValue(true);

      await service.select('client-1', 'biz_1', '123');

      expect(metaClient.verifyAdAccountAccess).toHaveBeenCalledWith(
        '123',
        'decrypted-token',
      );
      expect(repo.selectAdAccount).toHaveBeenCalledWith(
        'conn-1',
        'biz_1',
        '123',
      );
    });

    it('rejects without persisting when the connection cannot access the ad account', async () => {
      repo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.verifyAdAccountAccess.mockResolvedValue(false);

      await expect(
        service.select('client-1', 'biz_1', '123'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.selectAdAccount).not.toHaveBeenCalled();
    });
  });
});
