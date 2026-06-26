import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { DateTime } from 'luxon';
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

  /** Envía digest diario al profesional a la hora configurada (ventana de 5 min). */
  @Cron('*/5 * * * *')
  async checkDailyDigest() {
    const now = new Date();

    const professionals = await this.prisma.professional.findMany({
      where: { isActive: true, dailyDigestEnabled: true },
      select: {
        id: true,
        timezone: true,
        dailyDigestTime: true,
        phone: true,
      },
    });

    for (const pro of professionals) {
      const dtNow = DateTime.fromJSDate(now).setZone(pro.timezone);
        const [hStr, mStr] = pro.dailyDigestTime.split(':');
        const targetHour = Number(hStr);
        const targetMinute = Number(mStr);

        // Ventana de 5 min: la hora/minuto del profesional cae dentro de la ventana actual
        const currentMinutes = dtNow.hour * 60 + dtNow.minute;
        const targetMinutes = targetHour * 60 + targetMinute;
        if (
          currentMinutes < targetMinutes ||
          currentMinutes >= targetMinutes + 5
        ) {
          continue;
        }

        // Verificar que no se haya enviado ya hoy
        const todayStart = dtNow.startOf('day').toJSDate();
        const alreadySent = await this.prisma.messageLog.findFirst({
          where: {
            professionalId: pro.id,
            messageType: 'SYSTEM',
            toPhone: pro.phone ?? undefined,
            sentAt: { gte: todayStart },
            content: { contains: 'Agenda del día' },
          },
        });

        if (alreadySent) continue;

        await this.whatsappMessaging.sendDailyDigestToProfessional(pro.id);
    }
  }

  /** Auto-confirma citas PENDING que ya recibieron recordatorio y están a menos de X horas. */
  @Cron('*/5 * * * *')
  async checkAutoConfirm() {
    const now = new Date();

    const professionals = await this.prisma.professional.findMany({
      where: { isActive: true, autoConfirmHours: { not: null } },
      select: { id: true, autoConfirmHours: true },
    });

    for (const pro of professionals) {
      if (!pro.autoConfirmHours) continue;

      const cutoff = new Date(
        now.getTime() + pro.autoConfirmHours * 60 * 60 * 1000,
      );

      const toConfirm = await this.prisma.appointment.findMany({
        where: {
          professionalId: pro.id,
          status: AppointmentStatus.PENDING,
          reminderSentAt: { not: null },
          startAt: { gte: now, lte: cutoff },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      });

      for (const apt of toConfirm) {
        await this.prisma.appointment.update({
          where: { id: apt.id },
          data: {
            status: AppointmentStatus.CONFIRMED,
            confirmationDeadline: null,
          },
        });
        void this.notifications
          .create({
            professionalId: apt.professionalId,
            organizationId: apt.organizationId ?? undefined,
            type: 'APPOINTMENT_AUTO_CONFIRMED',
            title: `Turno de ${apt.patient.firstName} ${apt.patient.lastName} auto-confirmado`,
            body: `El paciente no respondió dentro de la ventana de confirmación — el turno se confirmó automáticamente`,
            link: `/appointments?id=${apt.id}`,
            appointmentId: apt.id,
            patientId: apt.patientId,
            metadata: {
              patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
            },
          });
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
