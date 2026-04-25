import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import {
  MessageTemplatesService,
  TEMPLATABLE_TYPES,
  TemplatableType,
} from './message-templates.service';
import { UpsertTemplateDto } from './dto/upsert-template.dto';
import { BadRequestException } from '@nestjs/common';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly service: MessageTemplatesService) {}

  @Get()
  findAll(@CurrentProfessionalId() professionalId: string) {
    return this.service.findAll(professionalId);
  }

  @Put(':type')
  upsert(
    @CurrentProfessionalId() professionalId: string,
    @Param('type') type: string,
    @Body() dto: UpsertTemplateDto,
  ) {
    this.validateType(type);
    return this.service.upsert(professionalId, type as TemplatableType, dto);
  }

  @Delete(':type/reset')
  reset(
    @CurrentProfessionalId() professionalId: string,
    @Param('type') type: string,
  ) {
    this.validateType(type);
    return this.service.resetToDefault(professionalId, type as TemplatableType);
  }

  private validateType(type: string): void {
    if (!TEMPLATABLE_TYPES.includes(type as TemplatableType)) {
      throw new BadRequestException(`Tipo de plantilla inválido: ${type}`);
    }
  }
}
