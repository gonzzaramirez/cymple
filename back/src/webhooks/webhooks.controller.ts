import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('whatsapp')
  async whatsapp(
    @Body() payload: unknown,
    @Headers('x-evolution-webhook-token') webhookToken?: string,
  ) {
    this.logger.log(
      `Webhook recibido — payload keys: ${
        payload && typeof payload === 'object'
          ? Object.keys(payload).join(', ')
          : typeof payload
      }`,
    );

    const expectedToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (expectedToken && webhookToken !== expectedToken) {
      throw new UnauthorizedException('Webhook token inválido');
    }

    await this.webhooksService.handleWhatsappPayload(payload);
    return { status: 'accepted' };
  }
}
