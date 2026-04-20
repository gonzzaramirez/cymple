import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { WhatsappConnectionService } from './whatsapp-connection.service';

@Controller('whatsapp')
@SkipThrottle()
@UseGuards(JwtAuthGuard, TenantGuard)
export class WhatsappController {
  constructor(private readonly connection: WhatsappConnectionService) {}

  @Post('start')
  start(@CurrentProfessionalId() professionalId: string) {
    return this.connection.start(professionalId);
  }

  @Get('status')
  status(@CurrentProfessionalId() professionalId: string) {
    return this.connection.getStatus(professionalId);
  }

  @Post('logout')
  logout(@CurrentProfessionalId() professionalId: string) {
    return this.connection.logout(professionalId).then(() => ({ ok: true }));
  }
}
