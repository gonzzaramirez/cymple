import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import {
  MessageTemplatesService,
  TEMPLATABLE_TYPES,
  TemplatableType,
} from './message-templates.service';
import { UpsertTemplateDto } from './dto/upsert-template.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly service: MessageTemplatesService) {}

  @Get()
  findAll(@Req() req: Request) {
    const ctx = buildAccessContext(req);
    const proId = ctx.role !== 'CENTER_ADMIN' ? ctx.professionalId! : '';
    const orgId = ctx.organizationId ?? undefined;
    return this.service.findAll(proId, orgId);
  }

  @Put(':type')
  upsert(
    @Req() req: Request,
    @Param('type') type: string,
    @Body() dto: UpsertTemplateDto,
  ) {
    this.validateType(type);
    const ctx = buildAccessContext(req);
    const proId = ctx.role !== 'CENTER_ADMIN' ? ctx.professionalId! : '';
    const orgId = ctx.organizationId ?? undefined;
    return this.service.upsert(proId, type as TemplatableType, dto, orgId);
  }

  @Delete(':type/reset')
  reset(@Req() req: Request, @Param('type') type: string) {
    this.validateType(type);
    const ctx = buildAccessContext(req);
    const proId = ctx.role !== 'CENTER_ADMIN' ? ctx.professionalId! : '';
    const orgId = ctx.organizationId ?? undefined;
    return this.service.resetToDefault(proId, type as TemplatableType, orgId);
  }

  private validateType(type: string): void {
    if (!TEMPLATABLE_TYPES.includes(type as TemplatableType)) {
      throw new BadRequestException(`Tipo de plantilla inválido: ${type}`);
    }
  }
}
