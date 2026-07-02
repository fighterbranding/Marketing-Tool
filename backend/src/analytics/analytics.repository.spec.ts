jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsRepository, DailyMetric } from './analytics.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsRepository', () => {
  let repo: AnalyticsRepository;
  let prismaDb: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };

  beforeEach(async () => {
    prismaDb = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(AnalyticsRepository);
  });

  it('returns rows from $queryRaw for getMetrics', async () => {
    const mockRows: DailyMetric[] = [
      {
        day: new Date('2026-06-01'),
        spend: BigInt(5000),
        impressions: BigInt(1000),
        clicks: BigInt(50),
        conversions: BigInt(2),
      },
    ];
    prismaDb.$queryRaw.mockResolvedValue(mockRows);

    const result = await repo.getMetrics(
      'client-1',
      new Date('2026-06-01'),
      new Date('2026-06-30'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].impressions).toBe(BigInt(1000));
    expect(prismaDb.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('calls $executeRaw for upsertMetrics', async () => {
    prismaDb.$executeRaw.mockResolvedValue(1);

    await repo.upsertMetrics('client-1', 'campaign-1', new Date('2026-06-01'), {
      campaignId: 'campaign-1',
      impressions: 100,
      reach: 80,
      spend_cents: 500,
      clicks: 5,
      conversions: 1,
      ctr: 0.05,
      cpm_cents: 50,
      cpc_cents: 100,
    });

    expect(prismaDb.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
