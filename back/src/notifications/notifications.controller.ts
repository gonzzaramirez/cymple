import { Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findRecent(@Req() req: Request) {
    const ctx = buildAccessContext(req);
    const isOrg = ctx.role === 'CENTER_ADMIN';
    const id = isOrg ? ctx.organizationId : ctx.professionalId;
    return this.notificationsService.findRecent(id, isOrg);
  }

  @Patch('mark-read')
  markAllRead(@Req() req: Request) {
    const ctx = buildAccessContext(req);
    const isOrg = ctx.role === 'CENTER_ADMIN';
    const id = isOrg ? ctx.organizationId : ctx.professionalId;
    return this.notificationsService.markAllRead(id, isOrg);
  }
}
