jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));
jest.mock('@nestjs/jwt', () => ({
  JwtService: class MockJwtService {},
}));
jest.mock('./token-encryption.service', () => ({
  TokenEncryptionService: class MockTokenEncryptionService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaDb: { metaConnection: { findFirst: jest.Mock } };
  let jwt: { verifyAsync: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prismaDb = { metaConnection: { findFirst: jest.fn() } };
    jwt = { verifyAsync: jest.fn() };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { db: prismaDb } },
        { provide: JwtService, useValue: jwt },
        { provide: TokenEncryptionService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('getMetaConnectionStatus', () => {
    it('returns NEVER_CONNECTED when no connection exists', async () => {
      prismaDb.metaConnection.findFirst.mockResolvedValue(null);

      const result = await service.getMetaConnectionStatus('client-1');

      expect(prismaDb.metaConnection.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'client-1' } }),
      );
      expect(result).toBe('NEVER_CONNECTED');
    });

    it('returns ACTIVE when the most recent connection is active', async () => {
      prismaDb.metaConnection.findFirst.mockResolvedValue({ status: 'ACTIVE' });

      const result = await service.getMetaConnectionStatus('client-1');

      expect(result).toBe('ACTIVE');
    });

    it('returns NEEDS_RECONNECT when the most recent connection needs reconnecting', async () => {
      prismaDb.metaConnection.findFirst.mockResolvedValue({
        status: 'NEEDS_RECONNECT',
      });

      const result = await service.getMetaConnectionStatus('client-1');

      expect(result).toBe('NEEDS_RECONNECT');
    });

    it('returns NEEDS_RECONNECT when the most recent connection was revoked', async () => {
      prismaDb.metaConnection.findFirst.mockResolvedValue({
        status: 'REVOKED',
      });

      const result = await service.getMetaConnectionStatus('client-1');

      expect(result).toBe('NEEDS_RECONNECT');
    });
  });

  describe('createConnectTicket / consumeConnectTicket', () => {
    it('stores the clientId under a fresh random ticket and returns it on consume', async () => {
      const ticket = await service.createConnectTicket('client-1');

      expect(ticket).toEqual(expect.any(String));
      expect(cache.set).toHaveBeenCalledWith(
        `meta-connect-ticket:${ticket}`,
        'client-1',
        60 * 1000,
      );

      cache.get.mockResolvedValue('client-1');
      const resolved = await service.consumeConnectTicket(ticket);

      expect(cache.get).toHaveBeenCalledWith(`meta-connect-ticket:${ticket}`);
      expect(cache.del).toHaveBeenCalledWith(`meta-connect-ticket:${ticket}`);
      expect(resolved).toBe('client-1');
    });

    it('returns null and does not delete when the ticket is unknown or expired', async () => {
      cache.get.mockResolvedValue(undefined);

      const resolved = await service.consumeConnectTicket('missing-ticket');

      expect(resolved).toBeNull();
      expect(cache.del).not.toHaveBeenCalled();
    });
  });

  describe('createOAuthState / consumeOAuthState', () => {
    it('stores the clientId under a fresh random state and returns it on consume', async () => {
      const state = await service.createOAuthState('client-1');

      expect(state).toEqual(expect.any(String));
      expect(cache.set).toHaveBeenCalledWith(
        `meta-oauth-state:${state}`,
        'client-1',
        10 * 60 * 1000,
      );

      cache.get.mockResolvedValue('client-1');
      const resolved = await service.consumeOAuthState(state);

      expect(cache.get).toHaveBeenCalledWith(`meta-oauth-state:${state}`);
      expect(cache.del).toHaveBeenCalledWith(`meta-oauth-state:${state}`);
      expect(resolved).toBe('client-1');
    });

    it('returns null and does not delete when the state is unknown or expired', async () => {
      cache.get.mockResolvedValue(undefined);

      const resolved = await service.consumeOAuthState('missing-state');

      expect(resolved).toBeNull();
      expect(cache.del).not.toHaveBeenCalled();
    });
  });

  describe('buildMetaOAuthUrl', () => {
    it('includes the state param in the generated Facebook OAuth URL', () => {
      const url = new URL(service.buildMetaOAuthUrl('abc123'));

      expect(url.searchParams.get('state')).toBe('abc123');
    });
  });
});
