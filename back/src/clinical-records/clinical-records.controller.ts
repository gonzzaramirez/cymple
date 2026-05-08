import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import { ClinicalRecordsService } from './clinical-records.service';
import { CreateGeneralNoteDto } from './dto/create-general-note.dto';
import { ListClinicalRecordsDto } from './dto/list-clinical-records.dto';
import { ListNotesDto } from './dto/list-notes.dto';
import { UpdateClinicalRecordDto } from './dto/update-clinical-record.dto';
import { UpsertAppointmentReasonDto } from './dto/upsert-appointment-reason.dto';

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClinicalRecordsController {
  constructor(private readonly clinicalRecordsService: ClinicalRecordsService) {}

  @Post('patients/:id/clinical-records')
  createGeneralNote(
    @Req() req: Request,
    @Param('id') patientId: string,
    @Body() dto: CreateGeneralNoteDto,
  ) {
    return this.clinicalRecordsService.createGeneralNote(
      buildAccessContext(req),
      patientId,
      dto,
    );
  }

  @Get('patients/:id/clinical-records')
  listByPatient(
    @Req() req: Request,
    @Param('id') patientId: string,
    @Query() query: ListClinicalRecordsDto,
  ) {
    return this.clinicalRecordsService.listByPatient(
      buildAccessContext(req),
      patientId,
      query,
    );
  }

  @Get('appointments/:id/notes')
  listByAppointment(@Req() req: Request, @Param('id') appointmentId: string) {
    return this.clinicalRecordsService.listByAppointment(
      buildAccessContext(req),
      appointmentId,
    );
  }

  @Get('notes')
  listNotes(@Req() req: Request, @Query() query: ListNotesDto) {
    return this.clinicalRecordsService.listNotes(buildAccessContext(req), query);
  }

  @Put('appointments/:id/reason')
  upsertAppointmentReason(
    @Req() req: Request,
    @Param('id') appointmentId: string,
    @Body() dto: UpsertAppointmentReasonDto,
  ) {
    return this.clinicalRecordsService.upsertAppointmentReason(
      buildAccessContext(req),
      appointmentId,
      dto,
    );
  }

  @Patch('clinical-records/:id')
  update(
    @Req() req: Request,
    @Param('id') clinicalRecordId: string,
    @Body() dto: UpdateClinicalRecordDto,
  ) {
    return this.clinicalRecordsService.update(
      buildAccessContext(req),
      clinicalRecordId,
      dto,
    );
  }
}
