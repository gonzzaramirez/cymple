import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CenterAdminGuard } from '../common/auth/center-admin.guard';
import { CurrentOrganizationId } from '../common/tenant/current-organization-id.decorator';
import { OrganizationService } from './organization.service';
import { CreateMemberProfessionalDto } from './dto/create-member-professional.dto';
import { UpdateMemberProfessionalDto } from './dto/update-member-professional.dto';
import { UpdatePublicBookingSettingsDto } from './dto/update-public-booking-settings.dto';
import { PublicBookingService } from '../public-booking/public-booking.service';
import { BookingQueryDto } from '../public-booking/dto/booking-query.dto';
import { UpdateBookingStatusDto } from '../public-booking/dto/update-booking-status.dto';

@Controller('organization')
@UseGuards(JwtAuthGuard, TenantGuard, CenterAdminGuard)
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly publicBookingService: PublicBookingService,
  ) {}

  @Get()
  getOrganization(@CurrentOrganizationId() organizationId: string) {
    return this.organizationService.getOrganization(organizationId);
  }

  @Get('stats')
  getStats(@CurrentOrganizationId() organizationId: string) {
    return this.organizationService.getOrgStats(organizationId);
  }

  @Get('professionals')
  listProfessionals(
    @CurrentOrganizationId() organizationId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.organizationService.listProfessionals(
      organizationId,
      search,
      status,
    );
  }

  @Post('professionals')
  createProfessional(
    @CurrentOrganizationId() organizationId: string,
    @Body() dto: CreateMemberProfessionalDto,
  ) {
    return this.organizationService.createProfessional(organizationId, dto);
  }

  @Patch('professionals/:id')
  updateProfessional(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') professionalId: string,
    @Body() dto: UpdateMemberProfessionalDto,
  ) {
    return this.organizationService.updateProfessional(
      organizationId,
      professionalId,
      dto,
    );
  }

  @Delete('professionals/:id')
  deactivateProfessional(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') professionalId: string,
  ) {
    return this.organizationService.deactivateProfessional(
      organizationId,
      professionalId,
    );
  }

  // ── Public booking settings ────────────────────────────────────

  @Get('public-booking-settings')
  getPublicBookingSettings(@CurrentOrganizationId() organizationId: string) {
    return this.organizationService.getPublicBookingSettings(organizationId);
  }

  @Patch('public-booking-settings')
  updatePublicBookingSettings(
    @CurrentOrganizationId() organizationId: string,
    @Body() dto: UpdatePublicBookingSettingsDto,
  ) {
    return this.organizationService.updatePublicBookingSettings(
      organizationId,
      dto,
    );
  }

  // ── Org bookings dashboard ─────────────────────────────────────

  @Get('bookings')
  listOrgBookings(
    @CurrentOrganizationId() organizationId: string,
    @Query() query: BookingQueryDto,
  ) {
    return this.publicBookingService.listOrgBookings(organizationId, query);
  }

  @Get('bookings/:id')
  getOrgBookingDetail(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.publicBookingService.getOrgBookingDetail(organizationId, id);
  }

  @Patch('bookings/:id/deposit')
  async markOrgDepositPaid(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    await this.publicBookingService.markOrgDepositPaid(organizationId, id);
    return { success: true };
  }

  @Patch('bookings/:id/status')
  async cancelOrgBooking(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    if (dto.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Transición a estado "${dto.status}" no soportada. Use el flujo automático (WA, depósito, etc.) o contacte a soporte.`,
      );
    }
    await this.publicBookingService.cancelOrgBooking(
      organizationId,
      id,
      dto.cancelReason,
    );
    return { success: true };
  }

  @Patch('bookings/:id/confirm')
  async manualOrgConfirm(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    await this.publicBookingService.manualOrgConfirm(organizationId, id);
    return { success: true };
  }

  @Patch('bookings/:id/notes')
  async updateOrgNotes(
    @CurrentOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    await this.publicBookingService.updateOrgNotes(organizationId, id, notes);
    return { success: true };
  }
}
