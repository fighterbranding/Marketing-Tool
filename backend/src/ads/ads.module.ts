import { Module } from '@nestjs/common';
import { AdsRepository } from './ads.repository';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdSetsModule } from '../ad-sets/ad-sets.module';

@Module({
  imports: [MetaClientModule, AuthModule, CampaignsModule, AdSetsModule],
  providers: [AdsRepository, AdsService],
  controllers: [AdsController],
})
export class AdsModule {}
