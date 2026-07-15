import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdStatusDto } from './dto/update-ad-status.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

@Controller('campaigns/:campaignId/ad-sets/:adSetId/ads')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('File must be an image'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('adSetId') adSetId: string,
    @Body() dto: CreateAdDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adsService.create(req.clientId, campaignId, adSetId, dto, file);
  }

  @Get()
  list(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('adSetId') adSetId: string,
  ) {
    return this.adsService.list(req.clientId, campaignId, adSetId);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('adSetId') adSetId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAdStatusDto,
  ) {
    return this.adsService.updateStatus(
      req.clientId,
      campaignId,
      adSetId,
      id,
      dto.status,
    );
  }

  @Patch(':id')
  update(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('adSetId') adSetId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAdDto,
  ) {
    return this.adsService.update(req.clientId, campaignId, adSetId, id, dto);
  }

  @Delete(':id')
  delete(
    @Request() req: { clientId: string },
    @Param('campaignId') campaignId: string,
    @Param('adSetId') adSetId: string,
    @Param('id') id: string,
  ) {
    return this.adsService.delete(req.clientId, campaignId, adSetId, id);
  }
}
