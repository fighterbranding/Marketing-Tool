import { Inject, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const OAUTH_STATE_PREFIX = 'meta-oauth-state:';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const CONNECT_TICKET_PREFIX = 'meta-connect-ticket:';
const CONNECT_TICKET_TTL_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly encryption: TokenEncryptionService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
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

  buildMetaOAuthUrl(state: string): string {
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
    url.searchParams.set('state', state);
    return url.toString();
  }

  // A short-lived, single-use ticket lets the browser reach GET
  // /auth/meta/connect (a plain navigation, which can't carry an
  // Authorization header) without ever putting the real session JWT in a
  // URL — that would land in browser history and any access/proxy logs.
  async createConnectTicket(clientId: string): Promise<string> {
    const ticket = randomBytes(24).toString('hex');
    await this.cache.set(
      `${CONNECT_TICKET_PREFIX}${ticket}`,
      clientId,
      CONNECT_TICKET_TTL_MS,
    );
    return ticket;
  }

  async consumeConnectTicket(ticket: string): Promise<string | null> {
    const key = `${CONNECT_TICKET_PREFIX}${ticket}`;
    const clientId = await this.cache.get<string>(key);
    if (!clientId) return null;
    await this.cache.del(key);
    return clientId;
  }

  async createOAuthState(clientId: string): Promise<string> {
    const state = randomBytes(24).toString('hex');
    await this.cache.set(
      `${OAUTH_STATE_PREFIX}${state}`,
      clientId,
      OAUTH_STATE_TTL_MS,
    );
    return state;
  }

  async consumeOAuthState(state: string): Promise<string | null> {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const clientId = await this.cache.get<string>(key);
    if (!clientId) return null;
    await this.cache.del(key);
    return clientId;
  }

  async getMetaConnectionStatus(
    clientId: string,
  ): Promise<'ACTIVE' | 'NEEDS_RECONNECT' | 'NEVER_CONNECTED'> {
    const conn = await this.prisma.db.metaConnection.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    if (!conn) return 'NEVER_CONNECTED';
    return conn.status === 'ACTIVE' ? 'ACTIVE' : 'NEEDS_RECONNECT';
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
