import { Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findRecent(@CurrentProfessionalId() professionalId: string) {
    return this.notificationsService.findRecent(professionalId);
  }

  @Patch('mark-read')
  markAllRead(@CurrentProfessionalId() professionalId: string) {
    return this.notificationsService.markAllRead(professionalId);
  }
}
