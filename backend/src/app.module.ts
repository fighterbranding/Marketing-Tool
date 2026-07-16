import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { MetaClientModule } from './meta-client/meta-client.module';
import { SyncModule } from './sync/sync.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AdSetsModule } from './ad-sets/ad-sets.module';
import { AdsModule } from './ads/ads.module';
import { PagesModule } from './pages/pages.module';
import { AdAccountsModule } from './ad-accounts/ad-accounts.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: 6379,
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    AuthModule,
    MetaClientModule,
    SyncModule,
    AnalyticsModule,
    CampaignsModule,
    AdSetsModule,
    AdsModule,
    PagesModule,
    AdAccountsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
