import { Module } from '@nestjs/common';
import { CampaignsRepository } from './campaigns.repository';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [MetaClientModule, AuthModule],
  providers: [CampaignsRepository, CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsRepository],
})
export class CampaignsModule {}
