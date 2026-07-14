import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { TargetingSpec } from '../meta-client/meta-client.service';

export interface AdSetRecord {
  id: string;
  metaAdSetId: string;
  name: string;
  dailyBudgetCents: number;
  optimizationGoal: string;
  targeting: TargetingSpec;
  status: string;
  createdAt: Date;
}

interface AdSetRow {
  id: string;
  metaAdSetId: string;
  name: string;
  dailyBudgetCents: number;
  optimizationGoal: string;
  targeting: Prisma.JsonValue;
  status: string;
  createdAt: Date;
}

const AD_SET_SELECT = {
  id: true,
  metaAdSetId: true,
  name: true,
  dailyBudgetCents: true,
  optimizationGoal: true,
  targeting: true,
  status: true,
  createdAt: true,
} as const;

function toAdSetRecord(row: AdSetRow): AdSetRecord {
  return { ...row, targeting: row.targeting as unknown as TargetingSpec };
}

@Injectable()
export class AdSetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    campaignId: string,
    metaAdSetId: string,
    name: string,
    dailyBudgetCents: number,
    optimizationGoal: string,
    targeting: TargetingSpec,
  ): Promise<AdSetRecord> {
    const created = await this.prisma.db.adSet.create({
      data: {
        campaignId,
        metaAdSetId,
        name,
        dailyBudgetCents,
        optimizationGoal,
        targeting: targeting as unknown as Prisma.InputJsonValue,
        status: 'PAUSED',
      },
      select: AD_SET_SELECT,
    });
    return toAdSetRecord(created);
  }

  async findAllByCampaign(campaignId: string): Promise<AdSetRecord[]> {
    const rows = await this.prisma.db.adSet.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      select: AD_SET_SELECT,
    });
    return rows.map(toAdSetRecord);
  }

  async findOneScoped(
    campaignId: string,
    id: string,
  ): Promise<AdSetRecord | null> {
    const row = await this.prisma.db.adSet.findFirst({
      where: { id, campaignId },
      select: AD_SET_SELECT,
    });
    return row ? toAdSetRecord(row) : null;
  }

  async updateStatus(id: string, status: string): Promise<AdSetRecord> {
    const updated = await this.prisma.db.adSet.update({
      where: { id },
      data: { status },
      select: AD_SET_SELECT,
    });
    return toAdSetRecord(updated);
  }
}
