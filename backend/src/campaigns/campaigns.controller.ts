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
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Request() req: { clientId: string }, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(req.clientId, dto);
  }

  @Get()
  list(@Request() req: { clientId: string }) {
    return this.campaignsService.list(req.clientId);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: { clientId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.campaignsService.updateStatus(req.clientId, id, dto.status);
  }

  @Patch(':id')
  update(
    @Request() req: { clientId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(req.clientId, id, dto);
  }

  @Delete(':id')
  delete(@Request() req: { clientId: string }, @Param('id') id: string) {
    return this.campaignsService.delete(req.clientId, id);
  }
}
