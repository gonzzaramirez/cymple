import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  me(@CurrentProfessionalId() professionalId: string) {
    return this.authService.me(professionalId);
  }
}
