import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { ProfessionalService } from './professional.service';
import { UpdateProfessionalSettingsDto } from './dto/update-settings.dto';

@Controller('professional/settings')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProfessionalController {
  constructor(private readonly professionalService: ProfessionalService) {}

  @Get()
  getSettings(@CurrentProfessionalId() professionalId: string) {
    return this.professionalService.getSettings(professionalId);
  }

  @Patch()
  updateSettings(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: UpdateProfessionalSettingsDto,
  ) {
    return this.professionalService.updateSettings(professionalId, dto);
  }
}
