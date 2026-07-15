import { Module } from '@nestjs/common';
import { PagesRepository } from './pages.repository';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { MetaClientModule } from '../meta-client/meta-client.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [MetaClientModule, AuthModule],
  providers: [PagesRepository, PagesService],
  controllers: [PagesController],
})
export class PagesModule {}
