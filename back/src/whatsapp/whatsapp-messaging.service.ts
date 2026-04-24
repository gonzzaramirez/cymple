import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentStatus,
  MessageDirection,
  MessageType,
  WaStatus,
} from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  normalizeArWhatsappNumber,
  phonesMatch,
} from '../common/utils/phone.utils';
import { EvolutionApiService } from './evolution-api.service';
import { defaultWaInstanceName } from './whatsapp-connection.service';

function capitalizeEs(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatAppointmentHuman(
  startAt: Date,
  timezone: string,
): { weekday: string; dayMonth: string; time: string } {
  const weekday = capitalizeEs(
    new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      timeZone: timezone,
    }).format(startAt),
  );
  const dayMonth = capitalizeEs(
    new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      timeZone: timezone,
    }).format(startAt),
  );
  const time = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(startAt);
  return { weekday, dayMonth, time };
}

/** "Hoy", "Mañana" o cadena vacía si cae en otro día (usar fecha larga). */
function reminderRelativeDay(startAt: Date, timezone: string): string {
  const key = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const startKey = key(startAt);
  const now = new Date();
  const todayKey = key(now);
  if (startKey === todayKey) return 'Hoy';

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  let probe = new Date(now.getTime());
  for (let h = 1; h <= 48; h++) {
    probe = new Date(now.getTime() + h * 3600 * 1000);
    if (fmt.format(probe) !== todayKey) {
      if (startKey === fmt.format(probe)) return 'Mañana';
      break;
    }
  }

  return '';
}

@Injectable()
export class WhatsappMessagingService {
  private readonly logger = new Logger(WhatsappMessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionApiService,
    private readonly notifications: NotificationsService,
  ) {}

  private async resolveInstance(
    professionalId: string,
  ): Promise<string | null> {
    const pro = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { waInstanceName: true },
    });
    return pro?.waInstanceName ?? defaultWaInstanceName(professionalId);
  }

  async sendAppointmentCreated(appointmentId: string): Promise<void> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        professional: true,
      },
    });
    if (!row) return;

    const { professional, patient } = row;
    if (professional.waStatus !== WaStatus.CONNECTED) {
      this.logger.debug(
        `Omitiendo WA alta: profesional ${professional.id} no conectado`,
      );
      return;
    }
    if (!this.evolution.isConfigured()) return;

    const instance = await this.resolveInstance(professional.id);
    if (!instance) return;
    if (!patient.phone) return;

    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );

    const text =
      `Hola ${patient.firstName}! \u{1F5D3}\uFE0F\n` +
      `Te confirmamos tu turno con ${professional.fullName}:\n` +
      `\u{1F4C5} ${weekday}, ${dayMonth} a las ${time}hs\n\n` +
      `¡Te esperamos!`;

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(instance, to, text);
      await this.prisma.messageLog.create({
        data: {
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_CREATED,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      });
    } catch (e) {
      this.logger.error(e, `Fallo envío WA alta turno ${appointmentId}`);
      await this.prisma.messageLog.create({
        data: {
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_CREATED,
          toPhone: to,
          content: `[ERROR] ${e instanceof Error ? e.message : 'send failed'}`,
          sentAt: null,
        },
      });
    }
  }

  async sendAppointmentReminder(appointmentId: string): Promise<boolean> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        professional: true,
      },
    });
    if (!row) return false;

    const { professional, patient } = row;
    if (professional.waStatus !== WaStatus.CONNECTED) return false;
    if (!this.evolution.isConfigured()) return false;

    const instance = await this.resolveInstance(professional.id);
    if (!instance) return false;
    if (!patient.phone) return false;

    const rel = reminderRelativeDay(row.startAt, professional.timezone);
    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );
    const dayPhrase = rel || `${weekday} ${dayMonth}`;

    const text =
      `\u{1F4CB} Recordatorio de turno\n` +
      `Hola ${patient.firstName}! ${rel ? `${rel} tenés` : 'Tenés'} turno con ${professional.fullName} a las ${time}hs${rel ? '' : ` (${dayPhrase})`}.\n\n` +
      `Confirmá tu asistencia:\n` +
      `1\uFE0F\u20E3 Confirmo que voy\n` +
      `2\uFE0F\u20E3 No puedo asistir`;

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(instance, to, text);
      await this.prisma.messageLog.create({
        data: {
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_REMINDER,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      });
      return true;
    } catch (e) {
      this.logger.error(e, `Fallo envío recordatorio ${appointmentId}`);
      return false;
    }
  }

  /** Respuesta automática al paciente (acuse). */
  async sendSystemText(params: {
    professionalId: string;
    patientId: string | null;
    appointmentId: string | null;
    toPhoneDigits: string;
    content: string;
  }): Promise<void> {
    const pro = await this.prisma.professional.findUnique({
      where: { id: params.professionalId },
      select: { waStatus: true, waInstanceName: true },
    });
    if (!pro || pro.waStatus !== WaStatus.CONNECTED) return;
    if (!this.evolution.isConfigured()) return;

    const instance =
      pro.waInstanceName ?? defaultWaInstanceName(params.professionalId);

    try {
      await this.evolution.sendText(
        instance,
        params.toPhoneDigits,
        params.content,
      );
      await this.prisma.messageLog.create({
        data: {
          professionalId: params.professionalId,
          patientId: params.patientId,
          appointmentId: params.appointmentId,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.SYSTEM,
          toPhone: params.toPhoneDigits,
          content: params.content,
          sentAt: new Date(),
        },
      });
    } catch (e) {
      this.logger.error(e, 'Fallo envío acuse WA');
    }
  }

  async sendAppointmentRescheduled(appointmentId: string): Promise<void> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, professional: true },
    });
    if (!row) return;

    const { professional, patient } = row;
    if (professional.waStatus !== WaStatus.CONNECTED) return;
    if (!this.evolution.isConfigured()) return;

    const instance = await this.resolveInstance(professional.id);
    if (!instance) return;
    if (!patient.phone) return;

    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );

    const text =
      `\u{1F504} Tu turno fue reprogramado.\n` +
      `Nueva fecha: *${weekday}, ${dayMonth} a las ${time}hs* con ${professional.fullName}.\n\n` +
      `\u{1F4CD} ¡Te esperamos!`;

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(instance, to, text);
      await this.prisma.messageLog.create({
        data: {
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_RESCHEDULED,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      });
      // In-app notification para el profesional
      await this.notifications.create({
        professionalId: professional.id,
        type: 'APPOINTMENT_RESCHEDULED',
        title: `Turno de ${patient.firstName} ${patient.lastName} reprogramado`,
        body: `Nuevo horario: ${weekday} ${dayMonth} a las ${time}hs — WA enviado al paciente`,
        link: '/appointments',
      });
    } catch (e) {
      this.logger.error(e, `Fallo envío WA reprogramación ${appointmentId}`);
    }
  }

  async sendAppointmentCancelledByProfessional(
    appointmentId: string,
  ): Promise<void> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, professional: true },
    });
    if (!row) return;

    const { professional, patient } = row;
    if (professional.waStatus !== WaStatus.CONNECTED) return;
    if (!this.evolution.isConfigured()) return;

    const instance = await this.resolveInstance(professional.id);
    if (!instance) return;
    if (!patient.phone) return;

    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );

    const text =
      `Hola ${patient.firstName}, tu turno del *${weekday} ${dayMonth} a las ${time}hs* con ${professional.fullName} fue cancelado.\n\n` +
      `Contactate con nosotros para reprogramar. ¡Hasta pronto! \u{1F44B}`;

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(instance, to, text);
      await this.prisma.messageLog.create({
        data: {
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_CANCELLED,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      });
      // In-app notification para el profesional (confirmación de que el WA salió)
      await this.notifications.create({
        professionalId: professional.id,
        type: 'APPOINTMENT_CANCELLED_SENT',
        title: `Turno de ${patient.firstName} ${patient.lastName} cancelado`,
        body: `${weekday} ${dayMonth} a las ${time}hs — WA de cancelación enviado al paciente`,
        link: '/appointments',
      });
    } catch (e) {
      this.logger.error(e, `Fallo envío WA cancelación ${appointmentId}`);
    }
  }

  async sendDailyDigestToProfessional(professionalId: string): Promise<boolean> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        timezone: true,
        waStatus: true,
        waInstanceName: true,
      },
    });

    if (!professional?.phone) return false;
    if (professional.waStatus !== WaStatus.CONNECTED) return false;
    if (!this.evolution.isConfigured()) return false;

    const instance = await this.resolveInstance(professionalId);
    if (!instance) return false;

    const now = new Date();
    const tz = professional.timezone;

    const dtNow = DateTime.fromJSDate(now).setZone(tz);
    const todayStartLocal = dtNow.startOf('day').toJSDate();
    const todayEndLocal = dtNow.endOf('day').toJSDate();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        startAt: { gte: todayStartLocal, lte: todayEndLocal },
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
      orderBy: { startAt: 'asc' },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    const humanDate = capitalizeEs(
      new Intl.DateTimeFormat('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: tz,
      }).format(now),
    );

    if (appointments.length === 0) {
      const text =
        `\u{1F4C5} *Agenda del día — ${humanDate}*\n\n` +
        `No tenés turnos programados para hoy. \u{2615}`;
      try {
        await this.evolution.sendText(
          instance,
          normalizeArWhatsappNumber(professional.phone),
          text,
        );
        await this.prisma.messageLog.create({
          data: {
            professionalId,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.SYSTEM,
            toPhone: normalizeArWhatsappNumber(professional.phone),
            content: text,
            sentAt: new Date(),
          },
        });
      } catch (e) {
        this.logger.error(e, 'Fallo envío digest diario (sin turnos)');
      }
      return true;
    }

    const lines = appointments.map((apt, i) => {
      const time = new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(apt.startAt);
      const statusIcon =
        apt.status === AppointmentStatus.CONFIRMED ? '\u{2705}' : '\u{1F7E1}';
      return `${i + 1}. ${time}hs — ${apt.patient.firstName} ${apt.patient.lastName} ${statusIcon}`;
    });

    const text =
      `\u{1F4C5} *Agenda del día — ${humanDate}*\n` +
      `Tenés *${appointments.length}* turno${appointments.length > 1 ? 's' : ''} programado${appointments.length > 1 ? 's' : ''} para hoy:\n\n` +
      lines.join('\n') +
      `\n\n_\u{2705} Confirmado  \u{1F7E1} Pendiente_`;

    try {
      await this.evolution.sendText(
        instance,
        normalizeArWhatsappNumber(professional.phone),
        text,
      );
      await this.prisma.messageLog.create({
        data: {
          professionalId,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.SYSTEM,
          toPhone: normalizeArWhatsappNumber(professional.phone),
          content: text,
          sentAt: new Date(),
        },
      });
      return true;
    } catch (e) {
      this.logger.error(e, 'Fallo envío digest diario');
      return false;
    }
  }

  async sendPaymentReminder(appointmentId: string): Promise<void> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        professional: true,
        revenue: true,
      },
    });
    if (!row) return;

    const { professional, patient } = row;
    if (professional.waStatus !== WaStatus.CONNECTED) return;
    if (!this.evolution.isConfigured()) return;

    const instance = await this.resolveInstance(professional.id);
    if (!instance) return;
    if (!patient.phone) return;

    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );
    const fee = row.revenue?.amount ?? row.fee;
    const feeFormatted = Number(fee).toLocaleString('es-AR');
    const aliasLine = professional.paymentAlias
      ? `\n\u{1F4B3} Alias: *${professional.paymentAlias}*`
      : '';

    const text =
      `Hola ${patient.firstName}! \u{1F917}\n\n` +
      `Muchas gracias por venir a tu sesión del *${weekday} ${dayMonth} a las ${time}hs*. ` +
      `Fue un gusto atenderte \u{1F4AB}\n\n` +
      `Te recordamos que tenés pendiente el pago de *$${feeFormatted}* correspondiente a esa sesión.${aliasLine}\n\n` +
      `_Si ya realizaste la transferencia, por favor ignorá este mensaje. \u{1F64F}_\n\n` +
      `\u{2764}\uFE0F Hasta la próxima, ${professional.fullName}`;

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(instance, to, text);
      await this.prisma.messageLog.create({
        data: {
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.PAYMENT_REMINDER,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      });
    } catch (e) {
      this.logger.error(e, `Fallo envío recordatorio pago ${appointmentId}`);
    }
  }

  async processPatientReply(
    instanceName: string,
    fromJidDigits: string,
    rawText: string,
  ): Promise<boolean> {
    const normalized = rawText.trim();
    const digitReply = normalized.replace(/\D/g, '');
    const lower = normalized.toLowerCase();

    // Feature D: texto libre además de 1/2
    const isOne =
      normalized === '1' ||
      digitReply === '1' ||
      /^1\uFE0F\u20E3/.test(normalized) ||
      /\b(si|sí|confirmo|voy|dale|ok|claro|perfecto|ahí estoy|ahi estoy)\b/.test(lower);
    const isTwo =
      normalized === '2' ||
      digitReply === '2' ||
      /^2\uFE0F\u20E3/.test(normalized) ||
      /\b(no|cancelo|cancelar|no puedo|no voy|imposible)\b/.test(lower);

    if (!isOne && !isTwo) return false;

    const idFromInstance = instanceName.startsWith('cymple-prof-')
      ? instanceName.slice('cymple-prof-'.length)
      : undefined;

    const professional = await this.prisma.professional.findFirst({
      where: {
        OR: [
          { waInstanceName: instanceName },
          ...(idFromInstance ? [{ id: idFromInstance }] : []),
        ],
      },
      select: { id: true, fullName: true, timezone: true, phone: true },
    });

    if (!professional) {
      this.logger.warn(`Instancia WA sin profesional: ${instanceName}`);
      return false;
    }

    const patients = await this.prisma.patient.findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    const patient = patients.find((p) => p.phone && phonesMatch(p.phone, fromJidDigits));

    if (!patient || !patient.phone) return false;

    const now = new Date();
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        professionalId: professional.id,
        patientId: patient.id,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: { gte: now },
      },
      orderBy: { startAt: 'asc' },
    });

    if (!appointment) return false;

    await this.prisma.messageLog.create({
      data: {
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: appointment.id,
        direction: MessageDirection.INBOUND,
        messageType: MessageType.PATIENT_REPLY,
        fromPhone: fromJidDigits,
        content: rawText,
        receivedAt: new Date(),
      },
    });

    const { time } = formatAppointmentHuman(
      appointment.startAt,
      professional.timezone,
    );
    const rel = reminderRelativeDay(appointment.startAt, professional.timezone);
    const whenLabel = rel || formatAppointmentHuman(appointment.startAt, professional.timezone).weekday;

    if (isOne) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.CONFIRMED },
      });
      const fechaCorta = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: professional.timezone,
      }).format(appointment.startAt);
      const ack =
        `\u{2705} ¡Listo, ${patient.firstName}! Tu turno quedó confirmado:\n` +
        `\u{1F4C5} ${fechaCorta} a las ${time} hs con ${professional.fullName}.\n\n` +
        `¡Te esperamos! Si necesitás algo antes, escribinos por acá.`;
      await this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: appointment.id,
        toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
        content: ack,
      });

      // Feature A: WA al profesional + in-app notification
      const patientName = `${patient.firstName} ${patient.lastName}`;
      const notifBody = `${rel ? rel : whenLabel} a las ${time}hs`;
      if (professional.phone) {
        void this.sendSystemText({
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: appointment.id,
          toPhoneDigits: normalizeArWhatsappNumber(professional.phone),
          content: `\u{2705} ${patientName} confirmó su turno de ${notifBody}`,
        }).catch(() => undefined);
      }
      void this.notifications.create({
        professionalId: professional.id,
        type: 'PATIENT_CONFIRMED',
        title: `${patientName} confirmó su turno`,
        body: notifBody,
        link: '/appointments',
      }).catch(() => undefined);

      return true;
    }

    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    const ack = `Entendido, ${patient.firstName}. Tu turno fue cancelado. ¡Hasta la próxima! \u{1F44B}`;
    await this.sendSystemText({
      professionalId: professional.id,
      patientId: patient.id,
      appointmentId: appointment.id,
      toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
      content: ack,
    });

    // Feature A: WA al profesional + in-app notification
    const patientName = `${patient.firstName} ${patient.lastName}`;
    const notifBody = `${rel ? rel : whenLabel} a las ${time}hs`;
    if (professional.phone) {
      void this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: appointment.id,
        toPhoneDigits: normalizeArWhatsappNumber(professional.phone),
        content: `\u{274C} ${patientName} canceló su turno de ${notifBody}`,
      }).catch(() => undefined);
    }
    void this.notifications.create({
      professionalId: professional.id,
      type: 'PATIENT_CANCELLED',
      title: `${patientName} canceló su turno`,
      body: notifBody,
      link: '/appointments',
    }).catch(() => undefined);

    return true;
  }
}
