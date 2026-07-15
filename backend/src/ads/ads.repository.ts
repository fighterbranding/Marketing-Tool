import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdRecord {
  id: string;
  metaAdId: string;
  name: string;
  headline: string;
  bodyText: string;
  ctaType: string;
  destinationUrl: string;
  imageHash: string;
  status: string;
  createdAt: Date;
}

export interface CreateAdFields {
  name: string;
  headline: string;
  bodyText: string;
  ctaType: string;
  destinationUrl: string;
  imageHash: string;
}

const AD_SELECT = {
  id: true,
  metaAdId: true,
  name: true,
  headline: true,
  bodyText: true,
  ctaType: true,
  destinationUrl: true,
  imageHash: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class AdsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    adSetId: string,
    metaAdId: string,
    fields: CreateAdFields,
  ): Promise<AdRecord> {
    return this.prisma.db.ad.create({
      data: { adSetId, metaAdId, ...fields, status: 'PAUSED' },
      select: AD_SELECT,
    });
  }

  async findAllByAdSet(adSetId: string): Promise<AdRecord[]> {
    return this.prisma.db.ad.findMany({
      where: { adSetId },
      orderBy: { createdAt: 'desc' },
      select: AD_SELECT,
    });
  }

  async findOneScoped(adSetId: string, id: string): Promise<AdRecord | null> {
    return this.prisma.db.ad.findFirst({
      where: { id, adSetId },
      select: AD_SELECT,
    });
  }

  async updateStatus(id: string, status: string): Promise<AdRecord> {
    return this.prisma.db.ad.update({
      where: { id },
      data: { status },
      select: AD_SELECT,
    });
  }
}
