import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentStatus,
  MessageDirection,
  MessageType,
  WaStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
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

  /**
   * Procesa respuesta del paciente (1 = confirmar, 2 = cancelar).
   * @returns true si se procesó un comando conocido
   */
  async processPatientReply(
    instanceName: string,
    fromJidDigits: string,
    rawText: string,
  ): Promise<boolean> {
    const normalized = rawText.trim();
    const digitReply = normalized.replace(/\D/g, '');
    const isOne =
      normalized === '1' ||
      digitReply === '1' ||
      /^1\uFE0F\u20E3/.test(normalized);
    const isTwo =
      normalized === '2' ||
      digitReply === '2' ||
      /^2\uFE0F\u20E3/.test(normalized);

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
      select: { id: true, fullName: true, timezone: true },
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
      select: { id: true, phone: true, firstName: true },
    });

    const patient = patients.find((p) => phonesMatch(p.phone, fromJidDigits));

    if (!patient) return false;

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

    if (isOne) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.CONFIRMED },
      });
      const { time } = formatAppointmentHuman(
        appointment.startAt,
        professional.timezone,
      );
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
    return true;
  }
}
