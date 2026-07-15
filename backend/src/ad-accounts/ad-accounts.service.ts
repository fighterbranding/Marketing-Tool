import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AdAccountsRepository,
  ActiveConnection,
} from './ad-accounts.repository';
import {
  MetaClientService,
  MetaBusiness,
  MetaAdAccount,
} from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';

export interface CurrentSelection {
  businessId: string | null;
  adAccountId: string | null;
}

@Injectable()
export class AdAccountsService {
  constructor(
    private readonly repo: AdAccountsRepository,
    private readonly metaClient: MetaClientService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async listBusinesses(clientId: string): Promise<MetaBusiness[]> {
    const conn = await this.requireConnection(clientId);
    const token = this.decrypt(conn);
    return this.metaClient.getBusinesses(token);
  }

  async listAdAccounts(
    clientId: string,
    businessId: string,
  ): Promise<MetaAdAccount[]> {
    const conn = await this.requireConnection(clientId);
    const token = this.decrypt(conn);
    return this.metaClient.getAdAccounts(businessId, token);
  }

  async getCurrentSelection(clientId: string): Promise<CurrentSelection> {
    const conn = await this.requireConnection(clientId);
    return { businessId: conn.businessId, adAccountId: conn.adAccountId };
  }

  async select(
    clientId: string,
    businessId: string,
    adAccountId: string,
  ): Promise<void> {
    const conn = await this.requireConnection(clientId);
    const token = this.decrypt(conn);

    const hasAccess = await this.metaClient.verifyAdAccountAccess(
      adAccountId,
      token,
    );
    if (!hasAccess) {
      throw new BadRequestException(
        'This connection does not have access to that ad account',
      );
    }

    await this.repo.selectAdAccount(conn.id, businessId, adAccountId);
  }

  private async requireConnection(clientId: string): Promise<ActiveConnection> {
    const conn = await this.repo.findActiveConnection(clientId);
    if (!conn) {
      throw new BadRequestException('No active Meta connection');
    }
    return conn;
  }

  private decrypt(
    conn: Pick<
      ActiveConnection,
      'encryptedToken' | 'encryptionIv' | 'encryptionTag'
    >,
  ): string {
    return this.encryption.decrypt(
      conn.encryptedToken,
      conn.encryptionIv,
      conn.encryptionTag,
    );
  }
}
