import {
  Body,
  Controller,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import type { Request } from 'express';

@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  private readonly expectedToken = process.env.EVOLUTION_WEBHOOK_TOKEN;

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('whatsapp')
  async whatsapp(
    @Req() req: Request,
    @Body() payload: unknown,
    @Query('token') queryToken: string | undefined,
  ) {
    if (this.expectedToken) {
      const headerToken = req?.headers?.['x-evolution-webhook-token'];
      const candidate =
        (typeof headerToken === 'string' ? headerToken : undefined) ??
        queryToken;

      if (!candidate) {
        throw new UnauthorizedException('Missing webhook token');
      }

      if (
        !crypto.timingSafeEqual(
          Buffer.from(candidate, 'utf-8'),
          Buffer.from(this.expectedToken, 'utf-8'),
        )
      ) {
        throw new UnauthorizedException('Invalid webhook token');
      }
    }

    await this.webhooksService.handleWhatsappPayload(payload);
    return { status: 'accepted' };
  }

  private extractInstance(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const root = payload as Record<string, unknown>;
    if (typeof root.instance === 'string') return root.instance;
    const data = root.data;
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (typeof d.instanceName === 'string') return d.instanceName;
    }
    return undefined;
  }
}
