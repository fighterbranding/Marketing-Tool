import { Module } from '@nestjs/common';
import { AdSetsRepository } from './ad-sets.repository';
import { AdSetsService } from './ad-sets.service';
import { AdSetsController } from './ad-sets.controller';
import { TargetingController } from './targeting.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [MetaClientModule, AuthModule, CampaignsModule],
  providers: [AdSetsRepository, AdSetsService],
  controllers: [AdSetsController, TargetingController],
})
export class AdSetsModule {}
