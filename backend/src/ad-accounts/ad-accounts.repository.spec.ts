jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AdAccountsRepository } from './ad-accounts.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('AdAccountsRepository', () => {
  let repo: AdAccountsRepository;
  let prismaDb: {
    metaConnection: { findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prismaDb = {
      metaConnection: { findFirst: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdAccountsRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(AdAccountsRepository);
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

  it('selectAdAccount updates the connection with the chosen business and ad account', async () => {
    prismaDb.metaConnection.update.mockResolvedValue({ id: 'conn-1' });

    await repo.selectAdAccount('conn-1', 'biz_1', '123');

    expect(prismaDb.metaConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { businessId: 'biz_1', adAccountId: '123' },
    });
  });
});
