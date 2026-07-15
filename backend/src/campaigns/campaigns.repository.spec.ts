jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsRepository } from './campaigns.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('CampaignsRepository', () => {
  let repo: CampaignsRepository;
  let prismaDb: {
    metaConnection: { findFirst: jest.Mock };
    campaign: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaDb = {
      metaConnection: { findFirst: jest.fn() },
      campaign: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsRepository,
        { provide: PrismaService, useValue: { db: prismaDb } },
      ],
    }).compile();

    repo = module.get(CampaignsRepository);
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

  it('create persists a new campaign as PAUSED', async () => {
    prismaDb.campaign.create.mockResolvedValue({ id: 'db-1' });

    await repo.create('client-1', 'meta-1', 'My campaign', 'OUTCOME_SALES');

    expect(prismaDb.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          clientId: 'client-1',
          metaCampaignId: 'meta-1',
          name: 'My campaign',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
        },
      }),
    );
  });

  it('findOneScoped scopes the lookup by clientId', async () => {
    prismaDb.campaign.findFirst.mockResolvedValue(null);

    const result = await repo.findOneScoped('client-1', 'camp-1');

    expect(prismaDb.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1', clientId: 'client-1' },
      }),
    );
    expect(result).toBeNull();
  });

  it('updateStatus updates the campaign by id', async () => {
    prismaDb.campaign.update.mockResolvedValue({
      id: 'camp-1',
      status: 'ACTIVE',
    });

    const result = await repo.updateStatus('camp-1', 'ACTIVE');

    expect(prismaDb.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1' },
        data: { status: 'ACTIVE' },
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('updateName updates the campaign name by id', async () => {
    prismaDb.campaign.update.mockResolvedValue({
      id: 'camp-1',
      name: 'Renamed',
    });

    const result = await repo.updateName('camp-1', 'Renamed');

    expect(prismaDb.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1' },
        data: { name: 'Renamed' },
      }),
    );
    expect(result.name).toBe('Renamed');
  });

  it('delete removes the campaign by id', async () => {
    prismaDb.campaign.delete.mockResolvedValue({ id: 'camp-1' });

    await repo.delete('camp-1');

    expect(prismaDb.campaign.delete).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
    });
  });
});
