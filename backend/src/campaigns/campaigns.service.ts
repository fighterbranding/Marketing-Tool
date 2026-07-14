import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignsRepository,
  CampaignRecord,
  ActiveConnection,
} from './campaigns.repository';
import {
  MetaClientService,
  ObjectStatus,
} from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly repo: CampaignsRepository,
    private readonly metaClient: MetaClientService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async create(
    clientId: string,
    dto: CreateCampaignDto,
  ): Promise<CampaignRecord> {
    const conn = await this.requireActiveConnection(clientId);

    const token = this.encryption.decrypt(
      conn.encryptedToken,
      conn.encryptionIv,
      conn.encryptionTag,
    );

    const created = await this.metaClient.createCampaign(
      conn.adAccountId,
      token,
      {
        name: dto.name,
        objective: dto.objective,
        specialAdCategories: dto.specialAdCategories ?? [],
      },
    );

    return this.repo.create(clientId, created.id, dto.name, dto.objective);
  }

  async list(clientId: string): Promise<CampaignRecord[]> {
    return this.repo.findAllByClient(clientId);
  }

  async updateStatus(
    clientId: string,
    id: string,
    status: ObjectStatus,
  ): Promise<CampaignRecord> {
    const campaign = await this.repo.findOneScoped(clientId, id);
    if (!campaign) throw new NotFoundException('Campaign not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.encryption.decrypt(
      conn.encryptedToken,
      conn.encryptionIv,
      conn.encryptionTag,
    );

    await this.metaClient.updateObjectStatus(
      campaign.metaCampaignId,
      token,
      status,
    );

    return this.repo.updateStatus(id, status);
  }

  private async requireActiveConnection(
    clientId: string,
  ): Promise<ActiveConnection & { adAccountId: string }> {
    const conn = await this.repo.findActiveConnection(clientId);
    if (!conn || !conn.adAccountId) {
      throw new BadRequestException('No active Meta ad account connected');
    }
    return { ...conn, adAccountId: conn.adAccountId };
  }
}
