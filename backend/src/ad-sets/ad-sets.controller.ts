import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { AdSetsService } from './ad-sets.service';
import { CreateAdSetDto } from './dto/create-ad-set.dto';
import { UpdateAdSetStatusDto } from './dto/update-ad-set-status.dto';

@Controller('campaigns/:campaignId/ad-sets')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class AdSetsController {
  constructor(private readonly adSetsService: AdSetsService) {}

  @Post()
  create(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAdSetDto,
  ) {
    return this.adSetsService.create(req.clientId, campaignId, dto);
  }

  @Get()
  list(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
  ) {
    return this.adSetsService.list(req.clientId, campaignId);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAdSetStatusDto,
  ) {
    return this.adSetsService.updateStatus(
      req.clientId,
      campaignId,
      id,
      dto.status,
    );
  }

  @Patch(':id')
  update(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: CreateAdSetDto,
  ) {
    return this.adSetsService.update(req.clientId, campaignId, id, dto);
  }

  @Delete(':id')
  delete(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
  ) {
    return this.adSetsService.delete(req.clientId, campaignId, id);
  }
}
