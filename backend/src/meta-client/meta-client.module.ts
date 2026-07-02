import { Module } from '@nestjs/common';
import { MetaClientService } from './meta-client.service';

@Module({
  providers: [MetaClientService],
  exports: [MetaClientService],
})
export class MetaClientModule {}
