import { Module } from '@nestjs/common';
import { AdAccountsRepository } from './ad-accounts.repository';
import { AdAccountsService } from './ad-accounts.service';
import { AdAccountsController } from './ad-accounts.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [MetaClientModule, AuthModule],
  providers: [AdAccountsRepository, AdAccountsService],
  controllers: [AdAccountsController],
})
export class AdAccountsModule {}
