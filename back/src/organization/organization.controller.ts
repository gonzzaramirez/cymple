import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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

@Controller('organization')
@UseGuards(JwtAuthGuard, TenantGuard, CenterAdminGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  getOrganization(@CurrentOrganizationId() organizationId: string) {
    return this.organizationService.getOrganization(organizationId);
  }

  @Get('stats')
  getStats(@CurrentOrganizationId() organizationId: string) {
    return this.organizationService.getOrgStats(organizationId);
  }

  @Get('professionals')
  listProfessionals(@CurrentOrganizationId() organizationId: string) {
    return this.organizationService.listProfessionals(organizationId);
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
}
