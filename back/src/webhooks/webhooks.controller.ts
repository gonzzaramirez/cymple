import {
  Body,
  Controller,
  Logger,
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
  private readonly logger = new Logger(WebhooksController.name);
  private readonly expectedToken = process.env.EVOLUTION_WEBHOOK_TOKEN;

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('whatsapp')
  async whatsapp(
    @Req() req: Request,
    @Body() payload: unknown,
    @Query('token') queryToken: string | undefined,
  ) {
    this.logger.log(
      `Webhook recibido — payload keys: ${
        payload && typeof payload === 'object'
          ? Object.keys(payload).join(', ')
          : typeof payload
      }`,
    );

    if (this.expectedToken) {
      const headerToken = req?.headers?.['x-evolution-webhook-token'];
      const candidate =
        (typeof headerToken === 'string' ? headerToken : undefined) ??
        queryToken;

      if (!candidate) {
        this.logger.warn(
          `Webhook REJECTED: no token provided. Headers received: ${JSON.stringify(Object.keys(req?.headers ?? {}))}. ` +
            `Configure Evolution API webhook URL as: https://YOUR_DOMAIN/v1/webhooks/whatsapp?token=YOUR_TOKEN ` +
            `or set the header x-evolution-webhook-token.`,
        );
        throw new UnauthorizedException('Missing webhook token');
      }

      if (
        !crypto.timingSafeEqual(
          Buffer.from(candidate, 'utf-8'),
          Buffer.from(this.expectedToken, 'utf-8'),
        )
      ) {
        this.logger.warn(
          `Webhook REJECTED: token mismatch. Instance: ${this.extractInstance(payload)}`,
        );
        throw new UnauthorizedException('Invalid webhook token');
      }
    } else {
      this.logger.warn(
        'EVOLUTION_WEBHOOK_TOKEN not configured — webhook endpoint accepts all requests until token is set',
      );
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
