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

  async logEvent(
    payload: unknown,
    eventType: string,
    source = 'evolution-api',
    professionalId?: string,
    organizationId?: string,
  ) {
    return this.prisma.webhookEventLog.create({
      data: {
        source,
        eventType,
        payload: payload as object,
        professionalId: professionalId ?? null,
        organizationId: organizationId ?? null,
      },
    });
  }

  async handleWhatsappPayload(payload: unknown) {
    const instanceName = extractInstanceName(payload);
    this.logger.log(
      `Instance: ${instanceName ?? 'NO RESUELTA'} | Payload type: ${typeof payload}`,
    );

    let professionalId: string | undefined;
    let organizationId: string | undefined;

    if (instanceName?.startsWith('cymple-org-')) {
      organizationId = instanceName.slice('cymple-org-'.length);
      this.logger.log(`Org webhook: ${organizationId}`);
    } else if (instanceName?.startsWith('cymple-prof-')) {
      professionalId = instanceName.slice('cymple-prof-'.length);
      this.logger.log(`Prof webhook: ${professionalId}`);
    } else if (instanceName) {
      const pro = await this.prisma.professional.findFirst({
        where: { waInstanceName: instanceName },
        select: { id: true },
      });
      professionalId = pro?.id;
      this.logger.log(
        `Resolved by waInstanceName: ${professionalId ?? 'NOT FOUND'}`,
      );
    }

    await this.logEvent(
      payload,
      'WHATSAPP_INBOUND',
      'evolution-api',
      professionalId,
      organizationId,
    );

    const inbound = extractInboundText(payload);
    if (!inbound) {
      this.logger.warn(
        'extractInboundText retornó null — posible LID, no-text, o fromMe',
      );
      if (!instanceName) {
        this.logger.warn('instanceName también es null, webhook descartado');
      }
      return;
    }

    this.logger.log(
      `Texto entrante: "${inbound.text.substring(0, 100)}" | fromJid: ${inbound.fromJid}`,
    );

    try {
      const result = await this.whatsappMessaging.processPatientReply(
        instanceName!,
        inbound.fromJid,
        inbound.text,
      );
      this.logger.log(`processPatientReply result: ${result}`);
    } catch (e) {
      this.logger.error(e, 'Error procesando respuesta WhatsApp');
    }
  }
}
