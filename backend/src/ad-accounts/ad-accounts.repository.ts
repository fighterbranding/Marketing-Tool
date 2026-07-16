import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActiveConnection {
  id: string;
  adAccountId: string | null;
  adAccountCurrency: string | null;
  businessId: string | null;
  encryptedToken: string;
  encryptionIv: string;
  encryptionTag: string;
}

@Injectable()
export class AdAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveConnection(
    clientId: string,
  ): Promise<ActiveConnection | null> {
    return this.prisma.db.metaConnection.findFirst({
      where: { clientId, status: 'ACTIVE' },
      select: {
        id: true,
        adAccountId: true,
        adAccountCurrency: true,
        businessId: true,
        encryptedToken: true,
        encryptionIv: true,
        encryptionTag: true,
      },
    });
  }

  async selectAdAccount(
    connectionId: string,
    businessId: string,
    adAccountId: string,
    currency: string | null,
  ): Promise<void> {
    await this.prisma.db.metaConnection.update({
      where: { id: connectionId },
      data: { businessId, adAccountId, adAccountCurrency: currency },
    });
  }
}
