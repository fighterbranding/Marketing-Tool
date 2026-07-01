import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.db.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const client = await this.prisma.db.client.create({ data: { name: dto.clientName } });
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.db.user.create({
      data: { email: dto.email, passwordHash, clientId: client.id, role: 'ADMIN' },
    });

    return { token: this.signJwt(user.id, user.clientId, user.role) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.db.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { token: this.signJwt(user.id, user.clientId, user.role) };
  }

  buildMetaOAuthUrl(): string {
    const scopes = [
      'ads_management',
      'ads_read',
      'business_management',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_manage_insights',
    ].join(',');

    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    url.searchParams.set('client_id', process.env.META_APP_ID!);
    url.searchParams.set('redirect_uri', process.env.META_REDIRECT_URI!);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async handleMetaCallback(code: string, clientId: string) {
    const shortLived = await this.exchangeCode(code);
    const longLived = await this.exchangeForLongLived(shortLived);
    await this.storeToken(longLived, clientId);
    return { ok: true };
  }

  async refreshExpiringTokens() {
    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const connections = await this.prisma.db.metaConnection.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: threshold } },
    });

    for (const conn of connections) {
      try {
        const current = this.encryption.decrypt(conn.encryptedToken, conn.encryptionIv, conn.encryptionTag);
        const fresh = await this.exchangeForLongLived(current);
        const encrypted = this.encryption.encrypt(fresh);
        await this.prisma.db.metaConnection.update({
          where: { id: conn.id },
          data: {
            encryptedToken: encrypted.ciphertext,
            encryptionIv: encrypted.iv,
            encryptionTag: encrypted.tag,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        });
      } catch {
        await this.prisma.db.metaConnection.update({
          where: { id: conn.id },
          data: { status: 'NEEDS_RECONNECT' },
        });
      }
    }
  }

  private async exchangeCode(code: string): Promise<string> {
    const res = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code,
      },
    });
    return res.data.access_token;
  }

  private async exchangeForLongLived(token: string): Promise<string> {
    const res = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: token,
      },
    });
    return res.data.access_token;
  }

  private async storeToken(token: string, clientId: string) {
    const encrypted = this.encryption.encrypt(token);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await this.prisma.db.metaConnection.create({
      data: {
        clientId,
        connectionType: 'USER_TOKEN',
        encryptedToken: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        encryptionTag: encrypted.tag,
        expiresAt,
        scopes: [
          'ads_management', 'ads_read', 'business_management',
          'pages_show_list', 'pages_read_engagement',
          'instagram_basic', 'instagram_manage_insights',
        ],
      },
    });
  }

  private signJwt(userId: string, clientId: string, role: string) {
    return this.jwt.sign({ sub: userId, clientId, role });
  }
}
