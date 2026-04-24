import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';

@Injectable()
export class ReminderSweeper {
  private readonly logger = new Logger(ReminderSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
  ) {}

  @Cron('*/5 * * * *')
  async checkPendingReminders() {
    const now = new Date();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        reminderScheduledFor: { lte: now },
        reminderSentAt: null,
      },
      include: {
        professional: {
          select: { id: true, fullName: true, reminderHours: true },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
      take: 50,
    });

    if (appointments.length === 0) return;

    this.logger.log(`Found ${appointments.length} pending reminders`);

    for (const appointment of appointments) {
      try {
        const sent = await this.whatsappMessaging.sendAppointmentReminder(
          appointment.id,
        );
        if (!sent) {
          this.logger.warn(
            `Recordatorio no enviado (WA no listo o error) ${appointment.id}`,
          );
          continue;
        }

        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { reminderSentAt: now },
        });

        this.logger.log(`Reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to send reminder for appointment ${appointment.id}: ${error}`,
        );
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
      try {
        const dtNow = DateTime.fromJSDate(now).setZone(pro.timezone);
        const [hStr, mStr] = pro.dailyDigestTime.split(':');
        const targetHour = Number(hStr);
        const targetMinute = Number(mStr);

        // Ventana de 5 min: la hora/minuto del profesional cae dentro de la ventana actual
        const currentMinutes = dtNow.hour * 60 + dtNow.minute;
        const targetMinutes = targetHour * 60 + targetMinute;
        if (currentMinutes < targetMinutes || currentMinutes >= targetMinutes + 5) {
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
        this.logger.log(`Daily digest sent to professional ${pro.id}`);
      } catch (error) {
        this.logger.error(`Failed to send daily digest to ${pro.id}: ${error}`);
      }
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
        select: { id: true },
      });

      for (const apt of toConfirm) {
        try {
          await this.prisma.appointment.update({
            where: { id: apt.id },
            data: { status: AppointmentStatus.CONFIRMED },
          });
          this.logger.log(`Auto-confirmed appointment ${apt.id}`);
        } catch (error) {
          this.logger.error(`Failed to auto-confirm appointment ${apt.id}: ${error}`);
        }
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

    this.logger.log(`Found ${appointments.length} pending payment reminders`);

    for (const apt of appointments) {
      try {
        await this.whatsappMessaging.sendPaymentReminder(apt.id);
        await this.prisma.appointment.update({
          where: { id: apt.id },
          data: { paymentReminderSentAt: now },
        });
        this.logger.log(`Payment reminder sent for appointment ${apt.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to send payment reminder for appointment ${apt.id}: ${error}`,
        );
      }
    }
  }
}
