import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import { WhatsappConnectionService } from './whatsapp-connection.service';

@Controller('whatsapp')
@SkipThrottle()
@UseGuards(JwtAuthGuard, TenantGuard)
export class WhatsappController {
  constructor(private readonly connection: WhatsappConnectionService) {}

  @Post('start')
  start(@Req() req: Request) {
    const ctx = buildAccessContext(req);
    if (ctx.role === 'CENTER_ADMIN') {
      return this.connection.startOrg(ctx.organizationId);
    }
    return this.connection.start(ctx.professionalId!);
  }

  @Get('status')
  status(@Req() req: Request) {
    const ctx = buildAccessContext(req);
    if (ctx.role === 'CENTER_ADMIN') {
      return this.connection.getStatusOrg(ctx.organizationId);
    }
    return this.connection.getStatus(ctx.professionalId!);
  }

  @Post('logout')
  logout(@Req() req: Request) {
    const ctx = buildAccessContext(req);
    if (ctx.role === 'CENTER_ADMIN') {
      return this.connection.logoutOrg(ctx.organizationId).then(() => ({ ok: true }));
    }
    return this.connection.logout(ctx.professionalId!).then(() => ({ ok: true }));
  }
}
