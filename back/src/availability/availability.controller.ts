import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import { UpsertWeeklyAvailabilityDto } from './dto/upsert-weekly-availability.dto';
import { UpsertSpecificDateAvailabilityDto } from './dto/upsert-specific-date-availability.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';

@Controller('availability')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  private resolveProfessionalId(req: Request, queryProfessionalId?: string): string {
    const ctx = buildAccessContext(req);
    if (ctx.role === 'CENTER_ADMIN') {
      if (!queryProfessionalId) {
        throw new BadRequestException('Parámetro professionalId requerido para administrador de centro');
      }
      return queryProfessionalId;
    }
    return ctx.professionalId!;
  }

  @Get('weekly')
  getWeekly(@Req() req: Request, @Query('professionalId') proId?: string) {
    return this.availabilityService.getWeekly(this.resolveProfessionalId(req, proId));
  }

  @Get('specific-dates')
  getSpecificDates(@Req() req: Request, @Query('professionalId') proId?: string) {
    return this.availabilityService.getSpecificDates(this.resolveProfessionalId(req, proId));
  }

  @Put('weekly')
  upsertWeekly(
    @Req() req: Request,
    @Body() dto: UpsertWeeklyAvailabilityDto,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.upsertWeekly(
      this.resolveProfessionalId(req, proId),
      dto,
    );
  }

  @Put('specific-dates')
  upsertSpecificDates(
    @Req() req: Request,
    @Body() dto: UpsertSpecificDateAvailabilityDto,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.upsertSpecificDates(
      this.resolveProfessionalId(req, proId),
      dto,
    );
  }

  @Get('slots')
  getSlots(
    @Req() req: Request,
    @Query() query: SlotsQueryDto,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.getSlots(
      this.resolveProfessionalId(req, proId),
      query.date,
    );
  }
}
