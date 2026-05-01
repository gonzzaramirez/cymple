import {
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
import { buildAccessContext } from '../common/tenant/access-context';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(buildAccessContext(req), dto);
  }

  @Get()
  list(@Req() req: Request, @Query() query: SearchPatientsDto) {
    return this.patientsService.list(buildAccessContext(req), query);
  }

  @Get('search')
  search(@Req() req: Request, @Query() query: SearchPatientsDto) {
    return this.patientsService.list(buildAccessContext(req), query);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') patientId: string) {
    return this.patientsService.getOne(buildAccessContext(req), patientId);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') patientId: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(buildAccessContext(req), patientId, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') patientId: string) {
    return this.patientsService.remove(buildAccessContext(req), patientId);
  }

  @Get(':id/history')
  history(@Req() req: Request, @Param('id') patientId: string) {
    return this.patientsService.history(buildAccessContext(req), patientId);
  }
}
