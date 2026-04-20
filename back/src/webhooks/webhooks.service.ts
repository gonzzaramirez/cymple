import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  extractInboundText,
  extractInstanceName,
} from '../whatsapp/evolution-webhook.util';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
  ) {}

  logEvent(
    payload: unknown,
    eventType: string,
    source = 'evolution-api',
    professionalId?: string,
  ) {
    return this.prisma.webhookEventLog.create({
      data: {
        source,
        eventType,
        payload: payload as object,
        professionalId: professionalId ?? null,
      },
    });
  }

  async handleWhatsappPayload(payload: unknown) {
    const instanceName = extractInstanceName(payload);
    let professionalId: string | undefined;
    if (instanceName?.startsWith('cymple-prof-')) {
      professionalId = instanceName.slice('cymple-prof-'.length);
    } else if (instanceName) {
      const pro = await this.prisma.professional.findFirst({
        where: { waInstanceName: instanceName },
        select: { id: true },
      });
      professionalId = pro?.id;
    }

    await this.logEvent(
      payload,
      'WHATSAPP_INBOUND',
      'evolution-api',
      professionalId,
    );

    const inbound = extractInboundText(payload);
    if (!inbound || !instanceName) {
      return;
    }

    try {
      await this.whatsappMessaging.processPatientReply(
        instanceName,
        inbound.fromJid,
        inbound.text,
      );
    } catch (e) {
      this.logger.error(e, 'Error procesando respuesta WhatsApp');
    }
  }
}
