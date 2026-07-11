import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { ShortUrlService } from './short-url.service';
import { CreateShortUrlDto } from './dto/create-short-url.dto';

// ── Authenticated Controller ──────────────────────────────────────

@Controller('short-urls')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ShortUrlController {
  constructor(private readonly shortUrlService: ShortUrlService) {}

  @Post()
  async create(@Body() dto: CreateShortUrlDto) {
    return this.shortUrlService.create(dto.originalUrl, {
      professionalId: dto.professionalId,
      organizationId: dto.organizationId,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId,
    });
  }
}

// ── Public Controller (no auth) ───────────────────────────────────

@Controller('public/short-urls')
export class PublicShortUrlController {
  constructor(private readonly shortUrlService: ShortUrlService) {}

  @Get(':code')
  async resolve(@Param('code') code: string) {
    const record = await this.shortUrlService.findByCode(code);
    if (!record) {
      throw new NotFoundException('Short URL not found');
    }
    // Increment click count on each resolution (fire & forget)
    await this.shortUrlService.incrementClick(record.id);
    return {
      originalUrl: record.originalUrl,
      expiresAt: record.expiresAt,
    };
  }
}
