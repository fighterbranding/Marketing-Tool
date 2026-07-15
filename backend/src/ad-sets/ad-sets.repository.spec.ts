jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AdSetsRepository } from './ad-sets.repository';
import { PrismaService } from '../prisma/prisma.service';
import type { TargetingSpec } from '../meta-client/meta-client.service';

describe('AdSetsRepository', () => {
  let repo: AdSetsRepository;
  let prismaDb: {
    adSet: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const targeting: TargetingSpec = {
    countries: ['US'],
    ageMin: 18,
    ageMax: 65,
    platforms: ['facebook', 'instagram'],
    interests: [{ id: '6003107902433', name: 'Fitness' }],
  };

  beforeEach(async () => {
    prismaDb = {
      adSet: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdSetsRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(AdSetsRepository);
  });

  it('create persists a new ad set as PAUSED with the targeting spec as JSON', async () => {
    prismaDb.adSet.create.mockResolvedValue({
      id: 'db-1',
      metaAdSetId: 'meta-1',
      name: 'Warm audience',
      dailyBudgetCents: 2000,
      optimizationGoal: 'LINK_CLICKS',
      targeting,
      status: 'PAUSED',
      createdAt: new Date(),
    });

    await repo.create(
      'camp-1',
      'meta-1',
      'Warm audience',
      2000,
      'LINK_CLICKS',
      targeting,
    );

    expect(prismaDb.adSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          campaignId: 'camp-1',
          metaAdSetId: 'meta-1',
          name: 'Warm audience',
          dailyBudgetCents: 2000,
          optimizationGoal: 'LINK_CLICKS',
          targeting,
          status: 'PAUSED',
        },
      }),
    );
  });

  it('findAllByCampaign scopes the lookup by campaignId', async () => {
    prismaDb.adSet.findMany.mockResolvedValue([]);

    const result = await repo.findAllByCampaign('camp-1');

    expect(prismaDb.adSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: 'camp-1' } }),
    );
    expect(result).toEqual([]);
  });

  it('findOneScoped scopes the lookup by campaignId', async () => {
    prismaDb.adSet.findFirst.mockResolvedValue(null);

    const result = await repo.findOneScoped('camp-1', 'adset-1');

    expect(prismaDb.adSet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'adset-1', campaignId: 'camp-1' },
      }),
    );
    expect(result).toBeNull();
  });

  it('updateStatus updates the ad set by id', async () => {
    prismaDb.adSet.update.mockResolvedValue({
      id: 'adset-1',
      metaAdSetId: 'meta-1',
      name: 'Warm audience',
      dailyBudgetCents: 2000,
      optimizationGoal: 'LINK_CLICKS',
      targeting,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const result = await repo.updateStatus('adset-1', 'ACTIVE');

    expect(prismaDb.adSet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'adset-1' },
        data: { status: 'ACTIVE' },
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('updateFields updates name, budget, optimization goal, and targeting', async () => {
    prismaDb.adSet.update.mockResolvedValue({
      id: 'adset-1',
      metaAdSetId: 'meta-1',
      name: 'Renamed',
      dailyBudgetCents: 4000,
      optimizationGoal: 'REACH',
      targeting,
      status: 'PAUSED',
      createdAt: new Date(),
    });

    const result = await repo.updateFields(
      'adset-1',
      'Renamed',
      4000,
      'REACH',
      targeting,
    );

    expect(prismaDb.adSet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'adset-1' },
        data: {
          name: 'Renamed',
          dailyBudgetCents: 4000,
          optimizationGoal: 'REACH',
          targeting,
        },
      }),
    );
    expect(result.name).toBe('Renamed');
  });

  it('delete removes the ad set by id', async () => {
    prismaDb.adSet.delete.mockResolvedValue({ id: 'adset-1' });

    await repo.delete('adset-1');

    expect(prismaDb.adSet.delete).toHaveBeenCalledWith({
      where: { id: 'adset-1' },
    });
  });
});
