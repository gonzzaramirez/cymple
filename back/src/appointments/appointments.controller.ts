import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@Controller('appointments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(professionalId, dto);
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
  changeStatus(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
    @Body() dto: ChangeAppointmentStatusDto,
  ) {
    return this.appointmentsService.changeStatus(
      professionalId,
      appointmentId,
      dto,
    );
  }

  @Patch(':id/reschedule')
  reschedule(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(
      professionalId,
      appointmentId,
      dto,
    );
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') appointmentId: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(professionalId, appointmentId, dto);
  }
}
