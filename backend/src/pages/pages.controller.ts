import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PagesService } from './pages.service';

@Controller('pages')
@UseGuards(JwtAuthGuard, ClientScopeGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  list(@Request() req: { clientId: string }) {
    return this.pagesService.list(req.clientId);
  }
}
