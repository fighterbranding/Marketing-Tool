jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AdsRepository } from './ads.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('AdsRepository', () => {
  let repo: AdsRepository;
  let prismaDb: {
    ad: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const fields = {
    name: 'Summer sale ad',
    headline: 'Big sale',
    bodyText: 'Everything must go',
    ctaType: 'SHOP_NOW',
    destinationUrl: 'https://example.com',
    imageHash: 'abc123',
  };

  beforeEach(async () => {
    prismaDb = {
      ad: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdsRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(AdsRepository);
  });

  it('create persists a new ad as PAUSED', async () => {
    prismaDb.ad.create.mockResolvedValue({ id: 'db-1' });

    await repo.create('adset-1', 'meta-ad-1', fields);

    expect(prismaDb.ad.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          adSetId: 'adset-1',
          metaAdId: 'meta-ad-1',
          ...fields,
          status: 'PAUSED',
        },
      }),
    );
  });

  it('findAllByAdSet scopes the lookup by adSetId', async () => {
    prismaDb.ad.findMany.mockResolvedValue([]);

    const result = await repo.findAllByAdSet('adset-1');

    expect(prismaDb.ad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { adSetId: 'adset-1' } }),
    );
    expect(result).toEqual([]);
  });

  it('findOneScoped scopes the lookup by adSetId', async () => {
    prismaDb.ad.findFirst.mockResolvedValue(null);

    const result = await repo.findOneScoped('adset-1', 'ad-1');

    expect(prismaDb.ad.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ad-1', adSetId: 'adset-1' } }),
    );
    expect(result).toBeNull();
  });

  it('updateStatus updates the ad by id', async () => {
    prismaDb.ad.update.mockResolvedValue({ id: 'ad-1', status: 'ACTIVE' });

    const result = await repo.updateStatus('ad-1', 'ACTIVE');

    expect(prismaDb.ad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ad-1' },
        data: { status: 'ACTIVE' },
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });
});
