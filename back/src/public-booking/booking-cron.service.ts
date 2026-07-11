import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MessageType } from '@prisma/client';
import { PublicBookingService } from './public-booking.service';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { AntiBanGuard, calculateTypingDelay } from '../whatsapp/antiban-guard';
import {
  AntiBanStateService,
  WaEntityRef,
} from '../whatsapp/antiban-state.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import {
  formatDateOnly,
  formatDateOnlyShort,
} from '../common/utils/date.utils';
@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  private readonly antiBanGuard = new AntiBanGuard();

  constructor(
    private readonly publicBookingService: PublicBookingService,
    private readonly evolution: EvolutionApiService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly messageTemplates: MessageTemplatesService,
    private readonly antiBanState: AntiBanStateService,
  ) {}

  /**
   * Every 15 minutes: expire bookings where deposit wasn't paid in time.
   */
  @Cron('*/15 * * * *')
  async checkBookingExpiry() {
    const bookings =
      await this.publicBookingService.getExpiredDepositBookings();

    for (const { booking, appointment, professional } of bookings) {
      // Expire the booking and cancel the appointment
      await this.publicBookingService.expireDepositBooking(
        booking.id,
        appointment?.id,
      );

      // Send WA notification using template
      const waInstance = await this.resolveWaInstance(professional.id);
      if (waInstance) {
        const slotDateHuman = formatDateOnly(booking.slotDate);

        const tpl = await this.messageTemplates.getOne(
          professional.id,
          MessageType.DEPOSIT_EXPIRED,
          professional.organizationId ?? undefined,
        );

        if (tpl.isEnabled) {
          const message = this.interpolate(tpl.body, {
            fechaHumana: slotDateHuman,
            horario: booking.slotStart,
          });

          await this.sendCronTextWithAntiBan(
            professional.id,
            professional.organizationId ?? undefined,
            waInstance,
            booking.patientPhone,
            message,
          );
        }
      }

      // In-app notification
      void this.notifications.create({
        professionalId: professional.id,
        organizationId: professional.organizationId ?? undefined,
        type: 'BOOKING_EXPIRED',
        title: 'Reserva vencida por seña no pagada',
        body: `${booking.patientName} — ${booking.slotStart}hs del ${formatDateOnlyShort(booking.slotDate)}`,
        link: `/bookings?id=${booking.id}`,
        metadata: { bookingToken: booking.token },
      });
    }
  }

  /**
   * Every 30 minutes: send deposit reminders for bookings expiring within 6 hours.
   */
  @Cron('*/30 * * * *')
  async sendDepositReminders() {
    const bookings =
      await this.publicBookingService.getPendingDepositReminders();

    for (const { booking, professional } of bookings) {
      const waInstance = await this.resolveWaInstance(professional.id);
      if (!waInstance) continue;

      const slotDateHuman = formatDateOnly(booking.slotDate);

      const tpl = await this.messageTemplates.getOne(
        professional.id,
        MessageType.DEPOSIT_REMINDER,
        professional.organizationId ?? undefined,
      );

      if (tpl.isEnabled) {
        const message = this.interpolate(tpl.body, {
          fechaHumana: slotDateHuman,
          horario: booking.slotStart,
          aliasPago: professional.paymentAlias ?? '—',
          montoSena: Number(professional.depositAmount ?? 0).toLocaleString(
            'es-AR',
          ),
        });

        await this.sendCronTextWithAntiBan(
          professional.id,
          professional.organizationId ?? undefined,
          waInstance,
          booking.patientPhone,
          message,
        );
      }

      await this.publicBookingService.markNotifiedExpiry(booking.id);
    }
  }

  /**
   * Every 15 minutes: auto-cancel unconfirmed bookings past the cancel threshold.
   */
  @Cron('*/15 * * * *')
  async cancelStaleUnconfirmedBookings() {
    const bookings =
      await this.publicBookingService.getUnconfirmedBookingsForCancel();

    for (const { booking, professional } of bookings) {
      await this.publicBookingService.expireUnconfirmedBooking(booking.id);

      // In-app notification for the professional
      void this.notifications.create({
        professionalId: professional.id,
        organizationId: professional.organizationId ?? undefined,
        type: 'BOOKING_EXPIRED',
        title: 'Reserva cancelada por falta de confirmación',
        body: `${booking.patientName} — ${booking.slotStart}hs del ${formatDateOnlyShort(booking.slotDate)}`,
        link: `/bookings?id=${booking.id}`,
        metadata: { bookingToken: booking.token },
      });
    }
  }

  /**
   * Envía un mensaje WA con protección anti-ban.
   * El entity ref se resuelve desde el professional.
   */
  private async sendCronTextWithAntiBan(
    professionalId: string,
    organizationId: string | undefined,
    waInstance: string,
    toPhone: string,
    text: string,
  ): Promise<void> {
    const ref: WaEntityRef = organizationId
      ? { type: 'organization', id: organizationId }
      : { type: 'professional', id: professionalId };

    await this.antiBanState.runSerialized(ref, async () => {
      const state = await this.antiBanState.loadState(ref);
      this.antiBanGuard.assertCanSend(state);

      const cooldownMs = this.antiBanGuard.getCooldownMs(state);
      if (cooldownMs > 0) {
        await new Promise((r) => setTimeout(r, cooldownMs));
      }

      const typingDelay = calculateTypingDelay(text);

      try {
        await this.evolution.sendText(waInstance, toPhone, text, {
          delay: typingDelay,
        });
        this.antiBanGuard.recordSuccess(state);
      } catch (error: any) {
        if (this.antiBanGuard.isBanSignalError(error.message)) {
          this.antiBanGuard.recordBanSignal(state);
        }
        throw error;
      } finally {
        await this.antiBanState.persistState(ref, state);
      }
    });
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = vars[key];
      if (val === undefined || val === null) return '';
      return val;
    });
  }

  private async resolveWaInstance(
    professionalId: string,
  ): Promise<string | null> {
    const pro = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { waInstanceName: true, organizationId: true },
    });
    if (!pro) return null;

    if (pro.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: pro.organizationId },
        select: { waInstanceName: true },
      });
      if (org?.waInstanceName) return org.waInstanceName;
    }

    return pro.waInstanceName;
  }
}
