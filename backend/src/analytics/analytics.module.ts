import { Module } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  providers: [AnalyticsRepository, AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsRepository],
})
export class AnalyticsModule {}
