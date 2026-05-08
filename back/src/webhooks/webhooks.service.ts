import { Injectable, Logger } from '@nestjs/common';
import { WaStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  extractInboundText,
  extractInstanceName,
} from '../whatsapp/evolution-webhook.util';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { WhatsappConnectionService } from '../whatsapp/whatsapp-connection.service';
import { maskPhone } from '../common/utils/phone.utils';

function detectEventType(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;

  // Evolution API v2: event is a top-level string
  if (typeof root.event === 'string') return root.event.toUpperCase();

  // Evolution API sends QRCODE_UPDATED / CONNECTION_UPDATE in various shapes
  const data = root.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.event === 'string') return d.event.toUpperCase();
  }

  return null;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
    private readonly whatsappConnection: WhatsappConnectionService,
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
    const eventType = detectEventType(payload);

    this.logger.log(
      `Webhook received — instance: ${instanceName ?? 'UNRESOLVED'} | event: ${eventType ?? 'NONE'} | payload type: ${typeof payload}`,
    );

    if (payload && typeof payload === 'object') {
      this.logger.debug(
        `Payload keys: ${Object.keys(payload as Record<string, unknown>).join(', ')}`,
      );
    }

    // ── CONNECTION_UPDATE: update waStatus in DB ──
    if (eventType === 'CONNECTION_UPDATE') {
      await this.handleConnectionUpdate(payload, instanceName);
      return;
    }

    // ── QRCODE_UPDATED: no action needed (just log) ──
    if (eventType === 'QRCODE_UPDATED') {
      this.logger.log(
        `QR code updated for instance ${instanceName ?? 'unknown'}`,
      );
      return;
    }

    // ── MESSAGES_UPSERT (default): process inbound message ──
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
      eventType ?? 'WHATSAPP_INBOUND',
      'evolution-api',
      professionalId,
      organizationId,
    );

    const inbound = extractInboundText(payload);
    if (!inbound) {
      this.logger.warn(
        `extractInboundText returned null — instance: ${instanceName ?? 'unknown'}, event: ${eventType}`,
      );
      return;
    }

    this.logger.log(
      `Inbound message: "${inbound.text.substring(0, 80)}" from ${maskPhone(inbound.fromJid)} | instance: ${instanceName}`,
    );

    try {
      const result = await this.whatsappMessaging.processPatientReply(
        instanceName!,
        inbound.fromJid,
        inbound.text,
        {
          mediaType: inbound.mediaType,
          isStructuredText: inbound.isStructuredText,
          previewText: inbound.previewText,
        },
      );
      this.logger.log(`processPatientReply result: ${result}`);
    } catch (e) {
      this.logger.error(e, 'Error processing WhatsApp reply');
    }
  }

  /**
   * Handles CONNECTION_UPDATE events from Evolution API.
   * Updates waStatus in Professional or Organization when the remote
   * session disconnects, connects, or is in a connecting state —
   * preventing "ghost" states where the DB shows CONNECTED but
   * the session was actually terminated on the phone.
   */
  private async handleConnectionUpdate(
    payload: unknown,
    instanceName: string | undefined,
  ) {
    if (!instanceName) {
      this.logger.warn('CONNECTION_UPDATE without instanceName — discarded');
      return;
    }

    // Extract state from various Evolution API payload shapes
    const root = payload as Record<string, unknown>;
    const data =
      typeof root.data === 'object' && root.data !== null
        ? (root.data as Record<string, unknown>)
        : root;

    const rawState =
      (typeof data.instance === 'object' && data.instance !== null
        ? (data.instance as Record<string, unknown>).state
        : undefined) ??
      data.state ??
      root.state;

    if (typeof rawState !== 'string') {
      this.logger.warn(
        `CONNECTION_UPDATE: could not extract state from payload for instance ${instanceName}`,
      );
      return;
    }

    const state = rawState.toLowerCase();
    this.logger.log(
      `CONNECTION_UPDATE: instance ${instanceName} → state: ${state}`,
    );

    const waStatus =
      state === 'open'
        ? WaStatus.CONNECTED
        : state === 'connecting'
          ? WaStatus.CONNECTING
          : WaStatus.DISCONNECTED;

    if (instanceName.startsWith('cymple-org-')) {
      const orgId = instanceName.slice('cymple-org-'.length);
      this.whatsappConnection.invalidateStatusCache('org', orgId);
      await this.prisma.organization
        .update({
          where: { id: orgId },
          data: { waStatus },
        })
        .catch((e) => {
          this.logger.warn(
            `Failed to update org ${orgId} waStatus: ${e.message}`,
          );
        });
      this.logger.log(`Organization ${orgId} waStatus → ${waStatus}`);
    } else if (instanceName.startsWith('cymple-prof-')) {
      const profId = instanceName.slice('cymple-prof-'.length);
      this.whatsappConnection.invalidateStatusCache('prof', profId);
      await this.prisma.professional
        .update({
          where: { id: profId },
          data: { waStatus },
        })
        .catch((e) => {
          this.logger.warn(
            `Failed to update professional ${profId} waStatus: ${e.message}`,
          );
        });
      this.logger.log(`Professional ${profId} waStatus → ${waStatus}`);
    } else {
      const pro = await this.prisma.professional.findFirst({
        where: { waInstanceName: instanceName },
        select: { id: true },
      });
      if (pro) {
        this.whatsappConnection.invalidateStatusCache('prof', pro.id);
        await this.prisma.professional
          .update({
            where: { id: pro.id },
            data: { waStatus },
          })
          .catch((e) => {
            this.logger.warn(
              `Failed to update professional ${pro.id} waStatus: ${e.message}`,
            );
          });
        this.logger.log(
          `Professional (by waInstanceName) ${pro.id} waStatus → ${waStatus}`,
        );
      } else {
        this.logger.warn(
          `CONNECTION_UPDATE: unknown instance ${instanceName}, no DB update`,
        );
      }
    }

    await this.logEvent(payload, 'CONNECTION_UPDATE', 'evolution-api');
  }
}
