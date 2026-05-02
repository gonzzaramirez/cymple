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
import { buildAccessContext } from '../common/tenant/access-context';
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
  async create(@Req() req: Request, @Body() dto: CreateAppointmentDto) {
    const ctx = buildAccessContext(req);
    const created = await this.appointmentsService.create(ctx, dto);
    this.audit.info(
      'appointment.created',
      {
        appointmentId: created.id,
        patientId: created.patientId,
        startAt: created.startAt,
      },
      req,
    );
    return created;
  }

  @Get()
  list(@Req() req: Request, @Query() query: ListAppointmentsDto) {
    return this.appointmentsService.list(buildAccessContext(req), query);
  }

  @Get('calendar')
  calendar(@Req() req: Request, @Query() query: CalendarQueryDto) {
    return this.appointmentsService.calendar(buildAccessContext(req), query);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') appointmentId: string) {
    return this.appointmentsService.getOne(
      buildAccessContext(req),
      appointmentId,
    );
  }

  @Patch(':id/status')
  async changeStatus(
    @Req() req: Request,
    @Param('id') appointmentId: string,
    @Body() dto: ChangeAppointmentStatusDto,
  ) {
    const ctx = buildAccessContext(req);
    const updated = await this.appointmentsService.changeStatus(
      ctx,
      appointmentId,
      dto,
    );
    this.audit.info(
      'appointment.status_changed',
      { appointmentId, status: dto.status },
      req,
    );
    return updated;
  }

  @Patch(':id/reschedule')
  async reschedule(
    @Req() req: Request,
    @Param('id') appointmentId: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    const ctx = buildAccessContext(req);
    const updated = await this.appointmentsService.reschedule(
      ctx,
      appointmentId,
      dto,
    );
    this.audit.info(
      'appointment.rescheduled',
      { appointmentId, newStartAt: updated.startAt },
      req,
    );
    return updated;
  }

  @Patch(':id/cancel')
  async cancel(
    @Req() req: Request,
    @Param('id') appointmentId: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    const ctx = buildAccessContext(req);
    const updated = await this.appointmentsService.cancel(
      ctx,
      appointmentId,
      dto,
    );
    this.audit.info(
      'appointment.cancelled',
      { appointmentId, reason: dto.reason ?? null },
      req,
    );
    return updated;
  }
}
