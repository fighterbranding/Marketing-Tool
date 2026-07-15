import { BadRequestException, Injectable } from '@nestjs/common';
import { PagesRepository } from './pages.repository';
import {
  MetaClientService,
  MetaInstagramAccount,
} from '../meta-client/meta-client.service';
import { TokenEncryptionService } from '../auth/token-encryption.service';

export interface PageWithInstagram {
  id: string;
  name: string;
  instagramAccount?: MetaInstagramAccount;
}

@Injectable()
export class PagesService {
  constructor(
    private readonly repo: PagesRepository,
    private readonly metaClient: MetaClientService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  // Always fetches live from Meta rather than reading a local cache — Pages
  // change rarely and there's no sync/schedule square for this surface in
  // docs/03-meta-api/pages-api.md, unlike Insights. Each page's own access
  // token gets persisted to MetaAsset as a side effect, since future
  // page-level calls (posting, page insights) need it and can't reuse the
  // user's token — see the "important detail" callout in that doc.
  async list(clientId: string): Promise<PageWithInstagram[]> {
    const conn = await this.repo.findActiveConnection(clientId);
    if (!conn) {
      throw new BadRequestException('No active Meta connection');
    }

    const token = this.encryption.decrypt(
      conn.encryptedToken,
      conn.encryptionIv,
      conn.encryptionTag,
    );

    const pages = await this.metaClient.getPages(token);

    return Promise.all(
      pages.map(async (page) => {
        const encrypted = this.encryption.encrypt(page.accessToken);
        await this.repo.upsertPage(
          conn.id,
          page.id,
          page.name,
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.tag,
        );
        return {
          id: page.id,
          name: page.name,
          instagramAccount: page.instagramAccount,
        };
      }),
    );
  }
}
