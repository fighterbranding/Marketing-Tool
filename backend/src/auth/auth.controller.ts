import { Controller, Get, Post, Body, Query, Res, Req, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('meta/connect/ticket')
  @UseGuards(JwtAuthGuard)
  async createConnectTicket(
    @Req() req: Request & { user: { clientId: string } },
  ) {
    return {
      ticket: await this.authService.createConnectTicket(req.user.clientId),
    };
  }

  @Get('meta/connect')
  async connectMeta(@Query('ticket') ticket: string, @Res() res: Response) {
    try {
      const clientId = await this.authService.consumeConnectTicket(ticket);
      if (!clientId) throw new Error('Invalid or expired ticket');
      const state = await this.authService.createOAuthState(clientId);
      res.redirect(this.authService.buildMetaOAuthUrl(state));
    } catch {
      res.redirect(`${process.env.FRONTEND_URL}/login`);
    }
  }

  @Get('meta/status')
  @UseGuards(JwtAuthGuard)
  async metaStatus(@Req() req: Request & { user: { clientId: string } }) {
    return {
      status: await this.authService.getMetaConnectionStatus(req.user.clientId),
    };
  }

  @Get('meta/callback')
  async metaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const clientId = await this.authService.consumeOAuthState(state);
      if (!clientId) throw new Error('Invalid or expired OAuth state');
      await this.authService.handleMetaCallback(code, clientId);
      res.redirect(`${process.env.FRONTEND_URL}/connect-meta/success`);
    } catch {
      res.redirect(`${process.env.FRONTEND_URL}/connect-meta/error`);
    }
  }
}
