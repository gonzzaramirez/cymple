import {
  Body,
  Controller,
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
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { ListAppointmentsDto } from './dto/list-appointments.dto';
import { ChangeAppointmentStatusDto } from './dto/change-status.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AuditLoggerService } from '../common/audit/audit-logger.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly audit: AuditLoggerService,
  ) {}

  @Post()
  async create(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: CreateAppointmentDto,
    @Req() req: Request,
  ) {
    const created = await this.appointmentsService.create(professionalId, dto);
    this.audit.info(
      'appointment.created',
      {
        professionalId,
        appointmentId: created.id,
        patientId: created.patientId,
        startAt: created.startAt,
      },
      req,
    );
    return created;
  }

  @Get()
  list(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: ListAppointmentsDto,
  ) {
    return this.appointmentsService.list(professionalId, query);
  }

  @Get('calendar')
  calendar(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.appointmentsService.calendar(professionalId, query);
  }

  @Get(':id')
  getOne(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
  ) {
    return this.appointmentsService.getOne(professionalId, appointmentId);
  }

  @Patch(':id/status')
  async changeStatus(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
    @Body() dto: ChangeAppointmentStatusDto,
    @Req() req: Request,
  ) {
    const updated = await this.appointmentsService.changeStatus(
      professionalId,
      appointmentId,
      dto,
    );
    this.audit.info(
      'appointment.status_changed',
      {
        professionalId,
        appointmentId,
        status: dto.status,
      },
      req,
    );
    return updated;
  }

  @Patch(':id/reschedule')
  async reschedule(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
    @Body() dto: RescheduleAppointmentDto,
    @Req() req: Request,
  ) {
    const updated = await this.appointmentsService.reschedule(
      professionalId,
      appointmentId,
      dto,
    );
    this.audit.info(
      'appointment.rescheduled',
      {
        professionalId,
        appointmentId,
        newStartAt: updated.startAt,
      },
      req,
    );
    return updated;
  }

  @Patch(':id/cancel')
  async cancel(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
    @Body() dto: CancelAppointmentDto,
    @Req() req: Request,
  ) {
    const updated = await this.appointmentsService.cancel(
      professionalId,
      appointmentId,
      dto,
    );
    this.audit.info(
      'appointment.cancelled',
      {
        professionalId,
        appointmentId,
        reason: dto.reason ?? null,
      },
      req,
    );
    return updated;
  }
}
