import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdSetsRepository, AdSetRecord } from './ad-sets.repository';
import {
  CampaignsRepository,
  ActiveConnection,
} from '../campaigns/campaigns.repository';
import {
  MetaClientService,
  ObjectStatus,
  TargetingSuggestion,
} from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { CreateAdSetDto } from './dto/create-ad-set.dto';

@Injectable()
export class AdSetsService {
  constructor(
    private readonly repo: AdSetsRepository,
    private readonly campaignsRepo: CampaignsRepository,
    private readonly metaClient: MetaClientService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async create(
    clientId: string,
    campaignId: string,
    dto: CreateAdSetDto,
  ): Promise<AdSetRecord> {
    const campaign = await this.requireCampaign(clientId, campaignId);
    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    const created = await this.metaClient.createAdSet(conn.adAccountId, token, {
      name: dto.name,
      metaCampaignId: campaign.metaCampaignId,
      dailyBudgetCents: dto.dailyBudgetCents,
      optimizationGoal: dto.optimizationGoal,
      targeting: dto.targeting,
    });

    return this.repo.create(
      campaignId,
      created.id,
      dto.name,
      dto.dailyBudgetCents,
      dto.optimizationGoal,
      dto.targeting,
    );
  }

  async list(clientId: string, campaignId: string): Promise<AdSetRecord[]> {
    await this.requireCampaign(clientId, campaignId);
    return this.repo.findAllByCampaign(campaignId);
  }

  async updateStatus(
    clientId: string,
    campaignId: string,
    id: string,
    status: ObjectStatus,
  ): Promise<AdSetRecord> {
    await this.requireCampaign(clientId, campaignId);

    const adSet = await this.repo.findOneScoped(campaignId, id);
    if (!adSet) throw new NotFoundException('Ad set not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    await this.metaClient.updateObjectStatus(adSet.metaAdSetId, token, status);
    return this.repo.updateStatus(id, status);
  }

  async update(
    clientId: string,
    campaignId: string,
    id: string,
    dto: CreateAdSetDto,
  ): Promise<AdSetRecord> {
    await this.requireCampaign(clientId, campaignId);

    const adSet = await this.repo.findOneScoped(campaignId, id);
    if (!adSet) throw new NotFoundException('Ad set not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    await this.metaClient.updateAdSet(adSet.metaAdSetId, token, {
      name: dto.name,
      dailyBudgetCents: dto.dailyBudgetCents,
      optimizationGoal: dto.optimizationGoal,
      targeting: dto.targeting,
    });

    return this.repo.updateFields(
      id,
      dto.name,
      dto.dailyBudgetCents,
      dto.optimizationGoal,
      dto.targeting,
    );
  }

  async delete(
    clientId: string,
    campaignId: string,
    id: string,
  ): Promise<void> {
    await this.requireCampaign(clientId, campaignId);

    const adSet = await this.repo.findOneScoped(campaignId, id);
    if (!adSet) throw new NotFoundException('Ad set not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    await this.metaClient.deleteObject(adSet.metaAdSetId, token);
    await this.repo.delete(id);
  }

  async searchTargeting(
    clientId: string,
    query: string,
  ): Promise<TargetingSuggestion[]> {
    if (query.trim().length < 2) return [];

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);
    return this.metaClient.searchTargeting(query, token);
  }

  private async requireCampaign(clientId: string, campaignId: string) {
    const campaign = await this.campaignsRepo.findOneScoped(
      clientId,
      campaignId,
    );
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async requireActiveConnection(
    clientId: string,
  ): Promise<ActiveConnection & { adAccountId: string }> {
    const conn = await this.campaignsRepo.findActiveConnection(clientId);
    if (!conn || !conn.adAccountId) {
      throw new BadRequestException('No active Meta ad account connected');
    }
    return { ...conn, adAccountId: conn.adAccountId };
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
