import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({ url: process.env.REDIS_URL, ttl: 60000 }),
      }),
    }),
  ],
})
export class CacheModule {}
