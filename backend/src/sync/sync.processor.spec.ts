jest.mock('bullmq', () => ({
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

jest.mock('../meta-client/meta-client.service', () => ({
  MetaClientService: class MockMetaClientService {},
}));

jest.mock('../analytics/analytics.repository', () => ({
  AnalyticsRepository: class MockAnalyticsRepository {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { SyncProcessor } from './sync.processor';
import { MetaClientService } from '../meta-client/meta-client.service';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { PrismaService } from '../prisma/prisma.service';

const makeJob = (data: { connectionId: string }) =>
  ({ data } as Job<{ connectionId: string }>);

describe('SyncProcessor', () => {
  let processor: SyncProcessor;
  let metaClient: { getInsights: jest.Mock };
  let analyticsRepo: { upsertMetrics: jest.Mock };
  let prismaDb: {
    metaConnection: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prismaDb = {
      metaConnection: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncProcessor,
        { provide: MetaClientService, useValue: { getInsights: jest.fn() } },
        { provide: AnalyticsRepository, useValue: { upsertMetrics: jest.fn() } },
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    processor = module.get(SyncProcessor);
    metaClient = module.get(MetaClientService) as { getInsights: jest.Mock };
    analyticsRepo = module.get(AnalyticsRepository) as { upsertMetrics: jest.Mock };
  });

  it('calls getInsights and upsertMetrics for an active connection', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      clientId: 'client-1',
      adAccountId: '123',
      status: 'ACTIVE',
      encryptedToken: 'enc',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    });
    metaClient.getInsights.mockResolvedValue([
      {
        campaignId: 'mock-001',
        impressions: 100,
        reach: 80,
        spend_cents: 500,
        clicks: 5,
        conversions: 1,
        ctr: 0.05,
        cpm_cents: 50,
        cpc_cents: 100,
      },
    ]);

    await processor.process(makeJob({ connectionId: 'conn-1' }));

    expect(metaClient.getInsights).toHaveBeenCalledWith('123', 'enc');
    expect(analyticsRepo.upsertMetrics).toHaveBeenCalledWith(
      'client-1',
      'mock-001',
      expect.any(Date),
      expect.objectContaining({ impressions: 100, spend_cents: 500 }),
    );
  });

  it('marks connection NEEDS_RECONNECT on Meta error 190 without rethrowing', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      clientId: 'client-1',
      adAccountId: '123',
      status: 'ACTIVE',
      encryptedToken: 'enc',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    });
    const terminalErr = Object.assign(new Error('token expired'), { metaErrorCode: 190 });
    metaClient.getInsights.mockRejectedValue(terminalErr);

    await expect(processor.process(makeJob({ connectionId: 'conn-1' }))).resolves.toBeUndefined();
    expect(prismaDb.metaConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'NEEDS_RECONNECT' },
    });
  });

  it('rethrows non-terminal errors so BullMQ retries', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      clientId: 'client-1',
      adAccountId: '123',
      status: 'ACTIVE',
      encryptedToken: 'enc',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    });
    metaClient.getInsights.mockRejectedValue(new Error('network timeout'));

    await expect(processor.process(makeJob({ connectionId: 'conn-1' }))).rejects.toThrow('network timeout');
  });

  it('skips job if connection is not found', async () => {
    prismaDb.metaConnection.findUnique.mockResolvedValue(null);

    await expect(processor.process(makeJob({ connectionId: 'gone' }))).resolves.toBeUndefined();
    expect(metaClient.getInsights).not.toHaveBeenCalled();
  });
});
