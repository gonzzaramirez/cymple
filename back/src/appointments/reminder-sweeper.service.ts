import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  ReminderDispatchOutcome,
  WhatsappMessagingService,
} from '../whatsapp/whatsapp-messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ANTIBAN_CONFIG } from '../whatsapp/antiban-guard';

// ─── Tuning del sweeper ────────────────────────────────────────────
// El envío real duerme ~6-30s por cooldown anti-ban (+ typing + latencia),
// así que el batch + el presupuesto de tiempo garantizan que un tick termine
// antes del próximo cron (5 min), incluso en el peor caso.
// (Solo lectura de operatingHoursStart; no se cambia ningún umbral anti-ban.)
/** Cuántos recordatorios reclama cada tick (cota superior; manda el budget). */
const REMINDER_BATCH_SIZE = 15;
/** Tiempo máximo de procesamiento por tick; el resto queda para el próximo. */
const REMINDER_TIME_BUDGET_MS = 4 * 60 * 1000;
/** TTL del claim: si la instancia muere con el lock tomado, otra lo reclama. */
const REMINDER_CLAIM_TTL_MS = 10 * 60 * 1000;
/** Backoff para fallos transitorios (WA desconectado, anti-ban, Evolution). */
const REMINDER_TRANSIENT_BACKOFF_MS = 15 * 60 * 1000;
/** Tope de intentos transitorios: después se marca skipped (visible, no silencio). */
const REMINDER_MAX_ATTEMPTS = 20;
/** Batch del cron de pago (mismo pipeline anti-ban, baja urgencia). */
const PAYMENT_BATCH_SIZE = 20;

/**
 * Próximo inicio de horario operativo (08:00 por defecto) en la tz dada.
 * Si ya pasó el de hoy, devuelve el de mañana.
 */
function nextOperatingStart(from: Date, tz: string): Date {
  const startHour = ANTIBAN_CONFIG.operatingHoursStart;
  const dt = DateTime.fromJSDate(from).setZone(tz);
  const todayStart = dt.startOf('day').plus({ hours: startHour });
  const next = dt < todayStart ? todayStart : todayStart.plus({ days: 1 });
  return next.toJSDate();
}

interface ReminderTickCounts {
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
}

@Injectable()
export class ReminderSweeper {
  private readonly logger = new Logger(ReminderSweeper.name);
  /** Anti-solapamiento en la misma instancia (el lock DB cubre multi-instancia). */
  private reminderRunInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/5 * * * *')
  async checkPendingReminders() {
    if (this.reminderRunInProgress) {
      this.logger.debug('[Reminder] tick anterior aún en curso, omito este.');
      return;
    }
    this.reminderRunInProgress = true;
    const startedAt = Date.now();
    const claimId = randomUUID();

    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - REMINDER_CLAIM_TTL_MS);

      const candidates = await this.prisma.appointment.findMany({
        where: {
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          reminderScheduledFor: { lte: now },
          reminderSentAt: null,
          reminderSkippedAt: null,
          OR: [
            { reminderClaimId: null },
            { reminderClaimedAt: { lt: staleBefore } },
          ],
        },
        select: { id: true },
        orderBy: { reminderScheduledFor: 'asc' },
        take: REMINDER_BATCH_SIZE,
      });

      if (candidates.length === 0) return;

      const ids = candidates.map((c) => c.id);

      // Claim condicional y atómico: si dos instancias reclaman lo mismo,
      // solo una gana cada fila (la otra no la ve al releer por claimId).
      await this.prisma.appointment.updateMany({
        where: {
          id: { in: ids },
          reminderSentAt: null,
          reminderSkippedAt: null,
          OR: [
            { reminderClaimId: null },
            { reminderClaimedAt: { lt: staleBefore } },
          ],
        },
        data: { reminderClaimId: claimId, reminderClaimedAt: now },
      });

      const claimed = await this.prisma.appointment.findMany({
        where: { id: { in: ids }, reminderClaimId: claimId },
        select: {
          id: true,
          reminderAttempts: true,
          professional: { select: { timezone: true } },
        },
      });

      if (claimed.length === 0) return;

      const counts: ReminderTickCounts = {
        sent: 0,
        skipped: 0,
        deferred: 0,
        failed: 0,
      };
      const processed = new Set<string>();

      for (const item of claimed) {
        if (Date.now() - startedAt > REMINDER_TIME_BUDGET_MS) break;
        processed.add(item.id);
        try {
          await this.processOneReminder(
            claimId,
            item.id,
            item.reminderAttempts,
            item.professional?.timezone,
            counts,
          );
        } catch (error: any) {
          // Un item que falla JAMÁS frena el resto del lote.
          counts.failed++;
          const msg =
            (typeof error?.message === 'string' && error.message) ||
            String(error);
          this.logger.warn(
            `[Reminder] ${item.id} error no controlado, sigue el lote: ${msg}`,
          );
          await this.markTransient(
            claimId,
            item.id,
            item.reminderAttempts,
            `unexpected: ${msg}`.slice(0, 500),
          ).catch(() => undefined);
        }
      }

      // Los reclamados que no entraron en el budget vuelven a la cola tal cual.
      const remaining = claimed
        .map((c) => c.id)
        .filter((id) => !processed.has(id));
      if (remaining.length > 0) {
        await this.prisma.appointment
          .updateMany({
            where: { id: { in: remaining }, reminderClaimId: claimId },
            data: { reminderClaimId: null, reminderClaimedAt: null },
          })
          .catch(() => undefined);
      }

      this.logger.log(
        `[Reminder] tick: claimed=${claimed.length} ` +
          `sent=${counts.sent} skipped=${counts.skipped} ` +
          `deferred=${counts.deferred} failed=${counts.failed}`,
      );
    } catch (error: any) {
      const msg =
        (typeof error?.message === 'string' && error.message) || String(error);
      this.logger.error(`[Reminder] tick abortado: ${msg}`);
      // Best-effort: soltar el lock para que el próximo tick recupere rápido.
      await this.prisma.appointment
        .updateMany({
          where: { reminderClaimId: claimId },
          data: { reminderClaimId: null, reminderClaimedAt: null },
        })
        .catch(() => undefined);
    } finally {
      this.reminderRunInProgress = false;
    }
  }

  private async processOneReminder(
    claimId: string,
    appointmentId: string,
    attempts: number,
    timezone: string | null | undefined,
    counts: ReminderTickCounts,
  ): Promise<void> {
    const outcome: ReminderDispatchOutcome =
      await this.whatsappMessaging.sendAppointmentReminder(appointmentId);
    const now = new Date();
    const release = { reminderClaimId: null, reminderClaimedAt: null };

    switch (outcome.status) {
      case 'sent': {
        counts.sent++;
        await this.prisma.appointment.updateMany({
          where: { id: appointmentId, reminderClaimId: claimId },
          data: {
            reminderSentAt: now,
            reminderAttempts: { increment: 1 },
            reminderLastError: null,
            ...release,
          },
        });
        return;
      }

      case 'skipped': {
        // Permanente (sin teléfono, plantilla off, turno pasado…): se marca
        // para no reintentar en silencio por siempre.
        counts.skipped++;
        this.logger.warn(
          `[Reminder] ${appointmentId} omitido permanente: ${outcome.reason}`,
        );
        await this.prisma.appointment.updateMany({
          where: { id: appointmentId, reminderClaimId: claimId },
          data: {
            reminderSkippedAt: now,
            reminderLastError: outcome.reason,
            reminderAttempts: { increment: 1 },
            ...release,
          },
        });
        return;
      }

      case 'deferred': {
        counts.deferred++;
        if (outcome.reason === 'outside-operating-hours') {
          // Respeto de operatingHours: se reprograma al próximo inicio
          // (08:00 en la tz del profesional) en vez de tirar el recordatorio.
          const tz = timezone ?? ANTIBAN_CONFIG.timezone;
          const nextStart = nextOperatingStart(now, tz);
          this.logger.log(
            `[Reminder] ${appointmentId} fuera de horario, reprogramado a ${nextStart.toISOString()}`,
          );
          await this.prisma.appointment.updateMany({
            where: { id: appointmentId, reminderClaimId: claimId },
            data: {
              reminderScheduledFor: nextStart,
              reminderLastError: outcome.reason,
              reminderAttempts: { increment: 1 },
              ...release,
            },
          });
          return;
        }
        await this.markTransient(
          claimId,
          appointmentId,
          attempts,
          outcome.reason,
        );
        return;
      }

      case 'failed': {
        counts.failed++;
        this.logger.warn(
          `[Reminder] ${appointmentId} fallo transitorio: ${outcome.reason}`,
        );
        await this.markTransient(
          claimId,
          appointmentId,
          attempts,
          outcome.reason,
        );
        return;
      }
    }
  }

  /**
   * Fallo transitorio (WA no conectado/configurado, anti-ban, Evolution):
   * backoff de 15 min con intentos acotados. Al llegar al tope se marca
   * skipped con el motivo (visible en reminderLastError) en vez de girar
   * infinito en silencio.
   */
  private async markTransient(
    claimId: string,
    appointmentId: string,
    attempts: number,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    const release = { reminderClaimId: null, reminderClaimedAt: null };
    if (attempts + 1 >= REMINDER_MAX_ATTEMPTS) {
      this.logger.warn(
        `[Reminder] ${appointmentId} supera ${REMINDER_MAX_ATTEMPTS} intentos, se omite: ${reason}`,
      );
      await this.prisma.appointment.updateMany({
        where: { id: appointmentId, reminderClaimId: claimId },
        data: {
          reminderSkippedAt: now,
          reminderLastError: `max-attempts: ${reason}`.slice(0, 500),
          reminderAttempts: { increment: 1 },
          ...release,
        },
      });
      return;
    }
    await this.prisma.appointment.updateMany({
      where: { id: appointmentId, reminderClaimId: claimId },
      data: {
        reminderScheduledFor: new Date(
          now.getTime() + REMINDER_TRANSIENT_BACKOFF_MS,
        ),
        reminderLastError: reason.slice(0, 500),
        reminderAttempts: { increment: 1 },
        ...release,
      },
    });
  }

  /** Envía recordatorio de pago 24hs después de la sesión (solo TRANSFER). */
  @Cron('*/5 * * * *')
  async checkPaymentReminders() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.ATTENDED,
        attendedAt: { lte: cutoff },
        paymentReminderSentAt: null,
        revenue: {
          paymentMethod: PaymentMethod.TRANSFER,
        },
      },
      select: { id: true },
      take: PAYMENT_BATCH_SIZE,
    });

    if (appointments.length === 0) return;

    for (const apt of appointments) {
      try {
        await this.whatsappMessaging.sendPaymentReminder(apt.id);
      } catch (error: any) {
        // Un item que falla no aborta el resto del lote.
        const msg =
          (typeof error?.message === 'string' && error.message) ||
          String(error);
        this.logger.warn(
          `[PaymentReminder] ${apt.id} falló, sigue el lote: ${msg}`,
        );
        continue;
      }
      try {
        await this.prisma.appointment.update({
          where: { id: apt.id },
          data: { paymentReminderSentAt: now },
        });
      } catch (error: any) {
        const msg =
          (typeof error?.message === 'string' && error.message) ||
          String(error);
        this.logger.warn(
          `[PaymentReminder] ${apt.id} no se pudo marcar, sigue el lote: ${msg}`,
        );
      }
    }
  }
}
