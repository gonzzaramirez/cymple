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
import { extractBookingToken } from '../public-booking/booking-token.util';
import { PublicBookingService } from '../public-booking/public-booking.service';

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

  // ── Idempotency guard: Evolution API puede reenviar el mismo evento ──
  private readonly processedMessageIds = new Map<string, number>();
  private readonly IDEMPOTENCY_TTL_MS = 60_000;

  private isDuplicateMessage(messageId: string): boolean {
    const now = Date.now();
    const processedAt = this.processedMessageIds.get(messageId);
    if (processedAt !== undefined) {
      if (now - processedAt < this.IDEMPOTENCY_TTL_MS) {
        return true; // Duplicado dentro de la ventana de TTL
      }
      // Expired entry — remove it
      this.processedMessageIds.delete(messageId);
    }
    this.processedMessageIds.set(messageId, now);
    return false;
  }

  /** Extrae el message key.id del payload de Evolution API. */
  private extractMessageKey(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const root = payload as Record<string, unknown>;

    // Evolution API v2: { data: { key: { id: "..." }, message: {...} } }
    const data = root.data;
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      const key = d.key;
      if (key && typeof key === 'object') {
        const id = (key as Record<string, unknown>).id;
        if (typeof id === 'string') return id;
      }
      // Array format: { data: { messages: [{ key: { id: "..." } }] } }
      const messages = d.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        const first = messages[0];
        if (first && typeof first === 'object') {
          const msgKey = (first as Record<string, unknown>).key;
          if (msgKey && typeof msgKey === 'object') {
            const id = (msgKey as Record<string, unknown>).id;
            if (typeof id === 'string') return id;
          }
        }
      }
    }

    return null;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
    private readonly whatsappConnection: WhatsappConnectionService,
    private readonly publicBookingService: PublicBookingService,
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

    // ── Idempotency: Evolution API puede reenviar el mismo evento ──
    if (
      eventType === 'MESSAGES_UPSERT' ||
      eventType === 'MESSAGES.UPSERT' ||
      eventType === 'WHATSAPP_INBOUND'
    ) {
      const messageId = this.extractMessageKey(payload);
      if (messageId && this.isDuplicateMessage(messageId)) {
        this.logger.debug(
          `[Idempotency] Skipping duplicate message ${messageId}`,
        );
        return;
      }
    }

    // ── CONNECTION_UPDATE: update waStatus in DB ──
    if (eventType === 'CONNECTION_UPDATE') {
      await this.handleConnectionUpdate(payload, instanceName);
      return;
    }

    // ── QRCODE_UPDATED: no action needed (just log) ──
    if (eventType === 'QRCODE_UPDATED') {
      return;
    }

    // ── MESSAGES_UPSERT (default): process inbound message ──
    let professionalId: string | undefined;
    let organizationId: string | undefined;

    if (instanceName?.startsWith('cymple-org-')) {
      organizationId = instanceName.slice('cymple-org-'.length);
    } else if (instanceName?.startsWith('cymple-prof-')) {
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
      eventType ?? 'WHATSAPP_INBOUND',
      'evolution-api',
      professionalId,
      organizationId,
    );

    const inbound = extractInboundText(payload);
    if (!inbound) {
      return;
    }

    // ── Booking token detection ──
    const bookingToken = extractBookingToken(inbound.text);
    if (bookingToken) {
      await this.publicBookingService.handleBookingConfirm(
        bookingToken,
        inbound.fromJid,
      );
      return; // Booking handled, don't process as regular reply
    }

    await this.whatsappMessaging.processPatientReply(
      instanceName!,
      inbound.fromJid,
      inbound.text,
      {
        mediaType: inbound.mediaType,
        isStructuredText: inbound.isStructuredText,
        previewText: inbound.previewText,
      },
    );
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
      return;
    }

    const state = rawState.toLowerCase();

    const waStatus =
      state === 'open'
        ? WaStatus.CONNECTED
        : state === 'connecting'
          ? WaStatus.CONNECTING
          : WaStatus.DISCONNECTED;

    if (instanceName.startsWith('cymple-org-')) {
      const orgId = instanceName.slice('cymple-org-'.length);
      this.whatsappConnection.invalidateStatusCache('org', orgId);
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { waStatus },
      });
    } else if (instanceName.startsWith('cymple-prof-')) {
      const profId = instanceName.slice('cymple-prof-'.length);
      this.whatsappConnection.invalidateStatusCache('prof', profId);
      await this.prisma.professional.update({
        where: { id: profId },
        data: { waStatus },
      });
    } else {
      const pro = await this.prisma.professional.findFirst({
        where: { waInstanceName: instanceName },
        select: { id: true },
      });
      if (pro) {
        this.whatsappConnection.invalidateStatusCache('prof', pro.id);
        await this.prisma.professional.update({
          where: { id: pro.id },
          data: { waStatus },
        });
      }
    }

    await this.logEvent(payload, 'CONNECTION_UPDATE', 'evolution-api');
  }
}
