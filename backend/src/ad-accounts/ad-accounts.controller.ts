import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { AdAccountsService } from './ad-accounts.service';
import { SelectAdAccountDto } from './dto/select-ad-account.dto';
import { ListAdAccountsQueryDto } from './dto/list-ad-accounts-query.dto';

@Controller('ad-accounts')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class AdAccountsController {
  constructor(private readonly adAccountsService: AdAccountsService) {}

  @Get('businesses')
  listBusinesses(@Request() req: { clientId: string }) {
    return this.adAccountsService.listBusinesses(req.clientId);
  }

  @Get('current')
  getCurrent(@Request() req: { clientId: string }) {
    return this.adAccountsService.getCurrentSelection(req.clientId);
  }

  @Get()
  listAdAccounts(
    @Request() req: { clientId: string },
    @Query() query: ListAdAccountsQueryDto,
  ) {
    return this.adAccountsService.listAdAccounts(
      req.clientId,
      query.businessId,
    );
  }

  @Post('select')
  select(
    @Request() req: { clientId: string },
    @Body() dto: SelectAdAccountDto,
  ) {
    return this.adAccountsService.select(
      req.clientId,
      dto.businessId,
      dto.adAccountId,
    );
  }
}
