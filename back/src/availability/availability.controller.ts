import {
  Controller,
  Get,
  Put,
  Body,
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

  private resolveProfessionalId(
    req: Request,
    queryProfessionalId?: string,
  ): Promise<string> {
    return this.availabilityService.resolveProfessionalIdForContext(
      buildAccessContext(req),
      queryProfessionalId,
    );
  }

  @Get('weekly')
  async getWeekly(
    @Req() req: Request,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.getWeekly(
      await this.resolveProfessionalId(req, proId),
    );
  }

  @Get('specific-dates')
  async getSpecificDates(
    @Req() req: Request,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.getSpecificDates(
      await this.resolveProfessionalId(req, proId),
    );
  }

  @Put('weekly')
  async upsertWeekly(
    @Req() req: Request,
    @Body() dto: UpsertWeeklyAvailabilityDto,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.upsertWeekly(
      await this.resolveProfessionalId(req, proId),
      dto,
    );
  }

  @Put('specific-dates')
  async upsertSpecificDates(
    @Req() req: Request,
    @Body() dto: UpsertSpecificDateAvailabilityDto,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.upsertSpecificDates(
      await this.resolveProfessionalId(req, proId),
      dto,
    );
  }

  @Get('slots')
  async getSlots(
    @Req() req: Request,
    @Query() query: SlotsQueryDto,
    @Query('professionalId') proId?: string,
  ) {
    return this.availabilityService.getSlots(
      await this.resolveProfessionalId(req, proId),
      query.date,
    );
  }
}
