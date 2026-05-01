import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { AuditLoggerService } from '../common/audit/audit-logger.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly audit: AuditLoggerService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    this.audit.info(
      'auth.login.attempt',
      { email: dto.email.toLowerCase().trim() },
      req,
    );
    try {
      const result = await this.authService.login(dto, req);
      this.audit.info(
        'auth.login.success',
        {
          professionalId: result.user.id,
          email: result.user.email,
        },
        req,
      );
      return result;
    } catch (error: any) {
      this.audit.warn(
        'auth.login.failed',
        {
          email: dto.email.toLowerCase().trim(),
          reason: error?.message ?? 'unknown',
        },
        req,
      );
      throw error;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  me(@CurrentProfessionalId() professionalId: string) {
    return this.authService.me(professionalId);
  }
}
