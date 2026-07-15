jest.mock('./pages.repository', () => ({
  PagesRepository: class MockPagesRepository {},
}));
jest.mock('../meta-client/meta-client.service', () => ({
  MetaClientService: class MockMetaClientService {},
}));
jest.mock('../auth/token-encryption.service', () => ({
  TokenEncryptionService: class MockTokenEncryptionService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesRepository } from './pages.repository';
import { MetaClientService } from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';

describe('PagesService', () => {
  let service: PagesService;
  let repo: { findActiveConnection: jest.Mock; upsertPage: jest.Mock };
  let metaClient: { getPages: jest.Mock };
  let encryption: { decrypt: jest.Mock; encrypt: jest.Mock };

  const activeConn = {
    id: 'conn-1',
    encryptedToken: 'enc',
    encryptionIv: 'iv',
    encryptionTag: 'tag',
  };

  beforeEach(async () => {
    repo = { findActiveConnection: jest.fn(), upsertPage: jest.fn() };
    metaClient = { getPages: jest.fn() };
    encryption = {
      decrypt: jest.fn().mockReturnValue('decrypted-token'),
      encrypt: jest.fn().mockReturnValue({
        ciphertext: 'page-enc',
        iv: 'page-iv',
        tag: 'page-tag',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PagesRepository, useValue: repo },
        { provide: MetaClientService, useValue: metaClient },
        { provide: TokenEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(PagesService);
  });

  describe('list', () => {
    it('fetches pages from Meta, persists each page token, and returns pages with Instagram info', async () => {
      repo.findActiveConnection.mockResolvedValue(activeConn);
      metaClient.getPages.mockResolvedValue([
        {
          id: 'page_1',
          name: 'My Page',
          accessToken: 'page-token-1',
          instagramAccount: { id: 'ig_1', username: 'my_ig' },
        },
      ]);
      repo.upsertPage.mockResolvedValue({
        id: 'asset-1',
        metaAssetId: 'page_1',
        name: 'My Page',
      });

      const result = await service.list('client-1');

      expect(encryption.decrypt).toHaveBeenCalledWith('enc', 'iv', 'tag');
      expect(metaClient.getPages).toHaveBeenCalledWith('decrypted-token');
      expect(encryption.encrypt).toHaveBeenCalledWith('page-token-1');
      expect(repo.upsertPage).toHaveBeenCalledWith(
        'conn-1',
        'page_1',
        'My Page',
        'page-enc',
        'page-iv',
        'page-tag',
      );
      expect(result).toEqual([
        {
          id: 'page_1',
          name: 'My Page',
          instagramAccount: { id: 'ig_1', username: 'my_ig' },
        },
      ]);
    });

    it('rejects when the client has no active Meta connection', async () => {
      repo.findActiveConnection.mockResolvedValue(null);

      await expect(service.list('client-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(metaClient.getPages).not.toHaveBeenCalled();
    });
  });
});
