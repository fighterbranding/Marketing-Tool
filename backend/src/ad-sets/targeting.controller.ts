import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { AdSetsService } from './ad-sets.service';

@Controller('targeting')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class TargetingController {
  constructor(private readonly adSetsService: AdSetsService) {}

  @Get('search')
  search(@Request() req: { clientId: string }, @Query('q') q?: string) {
    return this.adSetsService.searchTargeting(req.clientId, q ?? '');
  }
}
