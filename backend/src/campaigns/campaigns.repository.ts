import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActiveConnection {
  id: string;
  adAccountId: string | null;
  encryptedToken: string;
  encryptionIv: string;
  encryptionTag: string;
}

export interface CampaignRecord {
  id: string;
  metaCampaignId: string;
  name: string;
  objective: string;
  status: string;
  createdAt: Date;
}

const CAMPAIGN_SELECT = {
  id: true,
  metaCampaignId: true,
  name: true,
  objective: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class CampaignsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveConnection(
    clientId: string,
  ): Promise<ActiveConnection | null> {
    return this.prisma.db.metaConnection.findFirst({
      where: { clientId, status: 'ACTIVE' },
      select: {
        id: true,
        adAccountId: true,
        encryptedToken: true,
        encryptionIv: true,
        encryptionTag: true,
      },
    });
  }

  async create(
    clientId: string,
    metaCampaignId: string,
    name: string,
    objective: string,
  ): Promise<CampaignRecord> {
    return this.prisma.db.campaign.create({
      data: { clientId, metaCampaignId, name, objective, status: 'PAUSED' },
      select: CAMPAIGN_SELECT,
    });
  }

  async findAllByClient(clientId: string): Promise<CampaignRecord[]> {
    return this.prisma.db.campaign.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: CAMPAIGN_SELECT,
    });
  }

  async findOneScoped(
    clientId: string,
    id: string,
  ): Promise<CampaignRecord | null> {
    return this.prisma.db.campaign.findFirst({
      where: { id, clientId },
      select: CAMPAIGN_SELECT,
    });
  }

  async updateStatus(id: string, status: string): Promise<CampaignRecord> {
    return this.prisma.db.campaign.update({
      where: { id },
      data: { status },
      select: CAMPAIGN_SELECT,
    });
  }

  async updateName(id: string, name: string): Promise<CampaignRecord> {
    return this.prisma.db.campaign.update({
      where: { id },
      data: { name },
      select: CAMPAIGN_SELECT,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.db.campaign.delete({ where: { id } });
  }
}
