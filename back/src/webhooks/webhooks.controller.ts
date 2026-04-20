import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('whatsapp')
  async whatsapp(
    @Body() payload: unknown,
    @Headers('x-evolution-webhook-token') webhookToken?: string,
  ) {
    const expectedToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (expectedToken && webhookToken !== expectedToken) {
      throw new UnauthorizedException('Webhook token inválido');
    }

    await this.webhooksService.handleWhatsappPayload(payload);
    return { status: 'accepted' };
  }
}
