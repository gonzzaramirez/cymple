import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReminderSweeper {
  private readonly logger = new Logger(ReminderSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/5 * * * *')
  async checkPendingReminders() {
    const now = new Date();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        reminderScheduledFor: { lte: now },
        reminderSentAt: null,
      },
      include: {
        professional: {
          select: {
            id: true,
            fullName: true,
            reminderHours: true,
            confirmationWindowMinutes: true,
          },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
      take: 50,
    });

    if (appointments.length === 0) return;

    for (const appointment of appointments) {
      const sent = await this.whatsappMessaging.sendAppointmentReminder(
        appointment.id,
      );
      if (!sent) {
        continue;
      }
    }
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
      take: 50,
    });

    if (appointments.length === 0) return;

    for (const apt of appointments) {
      await this.whatsappMessaging.sendPaymentReminder(apt.id);
      await this.prisma.appointment.update({
        where: { id: apt.id },
        data: { paymentReminderSentAt: now },
      });
    }
  }

  /**
   * Verifica deadlines de confirmación expirados.
   * Si el paciente no respondió dentro de la ventana de confirmación,
   * y el turno está a más de 24hs, se reenvía el recordatorio.
   */
  @Cron('*/5 * * * *')
  async checkConfirmationDeadlines() {
    const now = new Date();
    const minReRequest = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const expired = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.PENDING,
        confirmationDeadline: { lte: now },
        startAt: { gte: minReRequest },
      },
      select: {
        id: true,
        startAt: true,
        professional: {
          select: { fullName: true },
        },
      },
      take: 50,
    });

    if (expired.length === 0) return;

    for (const apt of expired) {
      await this.prisma.appointment.update({
        where: { id: apt.id },
        data: {
          reminderSentAt: null,
          reminderScheduledFor: now,
          confirmationDeadline: null,
        },
      });
    }
  }
}
