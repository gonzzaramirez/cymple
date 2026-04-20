import {
  Body,
  Controller,
  Delete,
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
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(professionalId, dto);
  }

  @Get()
  list(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: SearchPatientsDto,
  ) {
    return this.patientsService.list(professionalId, query);
  }

  @Get('search')
  search(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: SearchPatientsDto,
  ) {
    return this.patientsService.list(professionalId, query);
  }

  @Get(':id')
  getOne(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') patientId: string,
  ) {
    return this.patientsService.getOne(professionalId, patientId);
  }

  @Patch(':id')
  update(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') patientId: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(professionalId, patientId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') patientId: string,
  ) {
    return this.patientsService.remove(professionalId, patientId);
  }

  @Get(':id/history')
  history(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') patientId: string,
  ) {
    return this.patientsService.history(professionalId, patientId);
  }
}
