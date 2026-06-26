import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { PublicBookingService } from './public-booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

// ── Public Controller (no auth) ───────────────────────────────────

@Controller('public')
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Get('professionals/:slug')
  async getProfessional(@Param('slug') slug: string) {
    const professional =
      await this.publicBookingService.getProfessionalBySlug(slug);
    if (!professional) {
      throw new NotFoundException(
        'Profesional no encontrado o reserva pública no habilitada',
      );
    }
    return professional;
  }

  @Get('professionals/:slug/availability')
  async getMonthAvailability(
    @Param('slug') slug: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (
      !from ||
      !to ||
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
      throw new BadRequestException(
        'Parámetros from y to requeridos con formato YYYY-MM-DD',
      );
    }
    return this.publicBookingService.getAvailability(slug, from, to);
  }

  @Get('professionals/:slug/slots')
  async getSlots(@Param('slug') slug: string, @Query('date') date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'Parámetro date requerido con formato YYYY-MM-DD',
      );
    }
    return this.publicBookingService.getSlots(slug, date);
  }

  @Post('booking')
  // Stricter rate limit on booking creation to prevent abuse
  // (allows ~5 bookings per minute per IP, vs 100/minute globally).
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createBooking(@Body() dto: CreateBookingDto) {
    return this.publicBookingService.createBooking(dto);
  }

  @Get('booking/:token/status')
  async getBookingStatus(@Param('token') token: string) {
    const status = await this.publicBookingService.getBookingStatus(token);
    if (!status) {
      throw new NotFoundException('Token de reserva no encontrado');
    }
    return status;
  }

  @Get('professionals/:slug/intake-status')
  async checkIntakeStatus(
    @Param('slug') slug: string,
    @Query('phone') phone: string,
  ) {
    if (!phone) {
      throw new BadRequestException('Parámetro phone requerido');
    }
    return this.publicBookingService.checkIntakeStatus(slug, phone);
  }
}

// ── Dashboard Controller (auth required) ──────────────────────────

@Controller('bookings')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BookingDashboardController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Get()
  async listBookings(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: BookingQueryDto,
  ) {
    return this.publicBookingService.listBookings(professionalId, query);
  }

  @Get(':id')
  async getBookingDetail(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
  ) {
    return this.publicBookingService.getBookingDetail(professionalId, id);
  }

  @Patch(':id/deposit')
  async markDepositPaid(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
  ) {
    await this.publicBookingService.markDepositPaid(professionalId, id);
    return { success: true };
  }

  @Patch(':id/status')
  async updateBookingStatus(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    if (dto.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Transición a estado "${dto.status}" no soportada. Use el flujo automático (WA, depósito, etc.) o contacte a soporte.`,
      );
    }
    await this.publicBookingService.cancelBooking(
      professionalId,
      id,
      dto.cancelReason,
    );
    return { success: true };
  }

  @Patch(':id/confirm')
  async manualConfirm(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
  ) {
    await this.publicBookingService.manualConfirm(professionalId, id);
    return { success: true };
  }

  @Patch(':id/notes')
  async updateNotes(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    await this.publicBookingService.updateNotes(professionalId, id, notes);
    return { success: true };
  }
}
