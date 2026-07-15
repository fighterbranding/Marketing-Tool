jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PagesRepository } from './pages.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('PagesRepository', () => {
  let repo: PagesRepository;
  let prismaDb: {
    metaConnection: { findFirst: jest.Mock };
    metaAsset: { upsert: jest.Mock };
  };

  beforeEach(async () => {
    prismaDb = {
      metaConnection: { findFirst: jest.fn() },
      metaAsset: { upsert: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(PagesRepository);
  });

  it('findActiveConnection scopes lookup to clientId and ACTIVE status', async () => {
    prismaDb.metaConnection.findFirst.mockResolvedValue({ id: 'conn-1' });

    const result = await repo.findActiveConnection('client-1');

    expect(prismaDb.metaConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', status: 'ACTIVE' },
      }),
    );
    expect(result).toEqual({ id: 'conn-1' });
  });

  it('upsertPage creates or updates a PAGE MetaAsset keyed by connectionId + metaAssetId', async () => {
    prismaDb.metaAsset.upsert.mockResolvedValue({
      id: 'asset-1',
      metaAssetId: 'page_1',
      name: 'My Page',
    });

    const result = await repo.upsertPage(
      'conn-1',
      'page_1',
      'My Page',
      'enc',
      'iv',
      'tag',
    );

    expect(prismaDb.metaAsset.upsert).toHaveBeenCalledWith({
      where: {
        connectionId_metaAssetId: {
          connectionId: 'conn-1',
          metaAssetId: 'page_1',
        },
      },
      create: {
        connectionId: 'conn-1',
        metaAssetId: 'page_1',
        assetType: 'PAGE',
        name: 'My Page',
        encryptedToken: 'enc',
        encryptionIv: 'iv',
        encryptionTag: 'tag',
      },
      update: {
        name: 'My Page',
        encryptedToken: 'enc',
        encryptionIv: 'iv',
        encryptionTag: 'tag',
      },
      select: { id: true, metaAssetId: true, name: true },
    });
    expect(result.name).toBe('My Page');
  });
});
