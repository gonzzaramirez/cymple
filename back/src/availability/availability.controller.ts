import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { UpsertWeeklyAvailabilityDto } from './dto/upsert-weekly-availability.dto';
import { UpsertSpecificDateAvailabilityDto } from './dto/upsert-specific-date-availability.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';

@Controller('availability')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('weekly')
  getWeekly(@CurrentProfessionalId() professionalId: string) {
    return this.availabilityService.getWeekly(professionalId);
  }

  @Get('specific-dates')
  getSpecificDates(@CurrentProfessionalId() professionalId: string) {
    return this.availabilityService.getSpecificDates(professionalId);
  }

  @Put('weekly')
  upsertWeekly(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: UpsertWeeklyAvailabilityDto,
  ) {
    return this.availabilityService.upsertWeekly(professionalId, dto);
  }

  @Put('specific-dates')
  upsertSpecificDates(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: UpsertSpecificDateAvailabilityDto,
  ) {
    return this.availabilityService.upsertSpecificDates(professionalId, dto);
  }

  @Get('slots')
  getSlots(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: SlotsQueryDto,
  ) {
    return this.availabilityService.getSlots(professionalId, query.date);
  }
}
