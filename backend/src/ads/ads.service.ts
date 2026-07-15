import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdsRepository, AdRecord } from './ads.repository';
import {
  CampaignsRepository,
  ActiveConnection,
} from '../campaigns/campaigns.repository';
import { AdSetsRepository } from '../ad-sets/ad-sets.repository';
import {
  MetaClientService,
  ObjectStatus,
} from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
}

@Injectable()
export class AdsService {
  constructor(
    private readonly repo: AdsRepository,
    private readonly campaignsRepo: CampaignsRepository,
    private readonly adSetsRepo: AdSetsRepository,
    private readonly metaClient: MetaClientService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async create(
    clientId: string,
    campaignId: string,
    adSetId: string,
    dto: CreateAdDto,
    file: UploadedFile | undefined,
  ): Promise<AdRecord> {
    if (!file) throw new BadRequestException('An image is required');

    await this.requireCampaign(clientId, campaignId);
    const adSet = await this.requireAdSet(campaignId, adSetId);
    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    const image = await this.metaClient.uploadImage(
      conn.adAccountId,
      token,
      file,
    );

    const creative = await this.metaClient.createAdCreative(
      conn.adAccountId,
      token,
      {
        name: `${dto.name} creative`,
        pageId: dto.pageId,
        imageHash: image.hash,
        destinationUrl: dto.destinationUrl,
        headline: dto.headline,
        bodyText: dto.bodyText,
        ctaType: dto.ctaType,
      },
    );

    const created = await this.metaClient.createAd(conn.adAccountId, token, {
      name: dto.name,
      metaAdSetId: adSet.metaAdSetId,
      creativeId: creative.id,
    });

    return this.repo.create(adSetId, created.id, {
      name: dto.name,
      headline: dto.headline,
      bodyText: dto.bodyText,
      ctaType: dto.ctaType,
      destinationUrl: dto.destinationUrl,
      imageHash: image.hash,
    });
  }

  async list(
    clientId: string,
    campaignId: string,
    adSetId: string,
  ): Promise<AdRecord[]> {
    await this.requireCampaign(clientId, campaignId);
    await this.requireAdSet(campaignId, adSetId);
    return this.repo.findAllByAdSet(adSetId);
  }

  async updateStatus(
    clientId: string,
    campaignId: string,
    adSetId: string,
    id: string,
    status: ObjectStatus,
  ): Promise<AdRecord> {
    await this.requireCampaign(clientId, campaignId);
    await this.requireAdSet(campaignId, adSetId);

    const ad = await this.repo.findOneScoped(adSetId, id);
    if (!ad) throw new NotFoundException('Ad not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    await this.metaClient.updateObjectStatus(ad.metaAdId, token, status);
    return this.repo.updateStatus(id, status);
  }

  async update(
    clientId: string,
    campaignId: string,
    adSetId: string,
    id: string,
    dto: UpdateAdDto,
  ): Promise<AdRecord> {
    await this.requireCampaign(clientId, campaignId);
    await this.requireAdSet(campaignId, adSetId);

    const ad = await this.repo.findOneScoped(adSetId, id);
    if (!ad) throw new NotFoundException('Ad not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    await this.metaClient.updateAd(ad.metaAdId, token, { name: dto.name });
    return this.repo.updateName(id, dto.name);
  }

  async delete(
    clientId: string,
    campaignId: string,
    adSetId: string,
    id: string,
  ): Promise<void> {
    await this.requireCampaign(clientId, campaignId);
    await this.requireAdSet(campaignId, adSetId);

    const ad = await this.repo.findOneScoped(adSetId, id);
    if (!ad) throw new NotFoundException('Ad not found');

    const conn = await this.requireActiveConnection(clientId);
    const token = this.decrypt(conn);

    await this.metaClient.deleteObject(ad.metaAdId, token);
    await this.repo.delete(id);
  }

  private async requireCampaign(clientId: string, campaignId: string) {
    const campaign = await this.campaignsRepo.findOneScoped(
      clientId,
      campaignId,
    );
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async requireAdSet(campaignId: string, adSetId: string) {
    const adSet = await this.adSetsRepo.findOneScoped(campaignId, adSetId);
    if (!adSet) throw new NotFoundException('Ad set not found');
    return adSet;
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
