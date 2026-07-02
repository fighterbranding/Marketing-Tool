import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { AnalyticsService, InsightsResponse } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('insights')
  async getInsights(
    @Request() req: { clientId: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<InsightsResponse> {
    return this.analyticsService.getInsights(
      req.clientId,
      new Date(from),
      new Date(to),
    );
  }
}
