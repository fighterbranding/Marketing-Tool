import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActiveConnection {
  id: string;
  encryptedToken: string;
  encryptionIv: string;
  encryptionTag: string;
}

export interface PageAssetRecord {
  id: string;
  metaAssetId: string;
  name: string;
}

const PAGE_SELECT = {
  id: true,
  metaAssetId: true,
  name: true,
} as const;

@Injectable()
export class PagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveConnection(
    clientId: string,
  ): Promise<ActiveConnection | null> {
    return this.prisma.db.metaConnection.findFirst({
      where: { clientId, status: 'ACTIVE' },
      select: {
        id: true,
        encryptedToken: true,
        encryptionIv: true,
        encryptionTag: true,
      },
    });
  }

  async upsertPage(
    connectionId: string,
    metaAssetId: string,
    name: string,
    encryptedToken: string,
    encryptionIv: string,
    encryptionTag: string,
  ): Promise<PageAssetRecord> {
    return this.prisma.db.metaAsset.upsert({
      where: { connectionId_metaAssetId: { connectionId, metaAssetId } },
      create: {
        connectionId,
        metaAssetId,
        assetType: 'PAGE',
        name,
        encryptedToken,
        encryptionIv,
        encryptionTag,
      },
      update: { name, encryptedToken, encryptionIv, encryptionTag },
      select: PAGE_SELECT,
    });
  }
}
