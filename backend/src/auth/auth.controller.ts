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

  @Get('meta/connect')
  @UseGuards(JwtAuthGuard)
  connectMeta(@Res() res: Response) {
    res.redirect(this.authService.buildMetaOAuthUrl());
  }

  @Get('meta/callback')
  @UseGuards(JwtAuthGuard)
  async metaCallback(
    @Query('code') code: string,
    @Req() req: Request & { user: { clientId: string } },
    @Res() res: Response,
  ) {
    try {
      await this.authService.handleMetaCallback(code, req.user.clientId);
      res.redirect(`${process.env.FRONTEND_URL}/connect-meta/success`);
    } catch {
      res.redirect(`${process.env.FRONTEND_URL}/connect-meta/error`);
    }
  }
}
