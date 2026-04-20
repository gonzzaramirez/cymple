import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus } from '@prisma/client';
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
}
