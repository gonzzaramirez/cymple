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
  maskPhone,
} from '../common/utils/phone.utils';
import { EvolutionApiService } from './evolution-api.service';
import {
  defaultWaInstanceName,
  defaultOrgWaInstanceName,
} from './whatsapp-connection.service';
import {
  MessageTemplatesService,
  TemplatableType,
} from '../message-templates/message-templates.service';

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
    private readonly messageTemplates: MessageTemplatesService,
  ) {}

  private async getTemplate(
    professionalId: string,
    type: TemplatableType,
    organizationId?: string,
  ): Promise<{ body: string; isEnabled: boolean }> {
    return this.messageTemplates.getOne(professionalId, type, organizationId);
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = vars[key];
      if (val === undefined || val === null) return '';
      return val;
    });
  }

  /**
   * Resuelve el contexto efectivo de WhatsApp para un profesional.
   * Si el profesional pertenece a un centro, usa la instancia y estado WA de la organización.
   */
  private async resolveEffectiveWaContext(
    professionalId: string,
    fallbackOrgId?: string | null,
  ): Promise<{
    instance: string;
    isConnected: boolean;
    organizationId: string | undefined;
  }> {
    const pro = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        waInstanceName: true,
        waStatus: true,
        organizationId: true,
      },
    });

    const effectiveOrgId = (pro?.organizationId ?? fallbackOrgId) || undefined;

    if (effectiveOrgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: effectiveOrgId },
        select: { waInstanceName: true, waStatus: true },
      });
      if (org?.waStatus === WaStatus.CONNECTED) {
        return {
          instance:
            org.waInstanceName ?? defaultOrgWaInstanceName(effectiveOrgId),
          isConnected: true,
          organizationId: effectiveOrgId,
        };
      }
    }

    return {
      instance: pro?.waInstanceName ?? defaultWaInstanceName(professionalId),
      isConnected: pro?.waStatus === WaStatus.CONNECTED,
      organizationId: effectiveOrgId,
    };
  }

  private async resolveInstance(
    professionalId: string,
  ): Promise<string | null> {
    const ctx = await this.resolveEffectiveWaContext(professionalId);
    return ctx.isConnected ? ctx.instance : null;
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
    if (!this.evolution.isConfigured()) return;

    const waCtx = await this.resolveEffectiveWaContext(
      professional.id,
      row.organizationId,
    );

    if (!waCtx.isConnected) {
      this.logger.debug(
        `Omitiendo WA alta: profesional ${professional.id} no conectado`,
      );
      return;
    }
    if (!patient.phone) return;

    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );

    const tpl = await this.getTemplate(
      professional.id,
      MessageType.APPOINTMENT_CREATED,
      waCtx.organizationId,
    );
    if (!tpl.isEnabled) return;

    const text = this.interpolate(tpl.body, {
      nombrePaciente: patient.firstName ?? '',
      nombreProfesional: professional.fullName ?? '',
      diaSemana: weekday,
      fechaMes: dayMonth,
      hora: time,
    });

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(waCtx.instance, to, text);
    } catch (e) {
      this.logger.error(e, `Fallo envío WA alta turno ${appointmentId}`);
      await this.prisma.messageLog
        .create({
          data: {
            professionalId: professional.id,
            organizationId: waCtx.organizationId,
            patientId: patient.id,
            appointmentId: row.id,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.APPOINTMENT_CREATED,
            toPhone: to,
            content: text,
            sentAt: null,
          },
        })
        .catch((logErr) =>
          this.logger.error(
            logErr,
            `Fallo log de error alta turno ${appointmentId}`,
          ),
        );
      return;
    }

    await this.prisma.messageLog
      .create({
        data: {
          professionalId: professional.id,
          organizationId: waCtx.organizationId,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_CREATED,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      })
      .catch((logErr) => {
        this.logger.error(logErr, `Fallo log de alta turno ${appointmentId}`);
      });
  }

  async sendAppointmentReminder(appointmentId: string): Promise<boolean> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        professional: true,
      },
    });
    if (!row) {
      this.logger.warn(
        `Recordatorio: appointment ${appointmentId} no encontrado`,
      );
      return false;
    }

    const { professional, patient } = row;
    if (!this.evolution.isConfigured()) {
      this.logger.warn('Recordatorio: Evolution no configurada');
      return false;
    }

    const waCtx = await this.resolveEffectiveWaContext(
      professional.id,
      row.organizationId,
    );
    if (!waCtx.isConnected) {
      this.logger.warn(
        `Recordatorio: WA no conectado para profesional ${professional.id} (orgId: ${waCtx.organizationId ?? 'ninguno'})`,
      );
      return false;
    }
    if (!patient.phone) {
      this.logger.warn(`Recordatorio: paciente ${patient.id} sin teléfono`);
      return false;
    }

    const rel = reminderRelativeDay(row.startAt, professional.timezone);
    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );
    const dayPhrase = rel || `${weekday} ${dayMonth}`;

    const tpl = await this.getTemplate(
      professional.id,
      MessageType.APPOINTMENT_REMINDER,
      waCtx.organizationId,
    );
    if (!tpl.isEnabled) {
      this.logger.warn(
        `Recordatorio: template deshabilitado para profesional ${professional.id}`,
      );
      return false;
    }

    const text = this.interpolate(tpl.body, {
      nombrePaciente: patient.firstName ?? '',
      nombreProfesional: professional.fullName ?? '',
      diaSemana: weekday,
      fechaMes: dayMonth,
      hora: time,
      diaRelativo: dayPhrase,
    });

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(waCtx.instance, to, text);
    } catch (e) {
      this.logger.error(e, `Fallo envío recordatorio ${appointmentId}`);
      await this.prisma.messageLog
        .create({
          data: {
            professionalId: professional.id,
            organizationId: waCtx.organizationId,
            patientId: patient.id,
            appointmentId: row.id,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.APPOINTMENT_REMINDER,
            toPhone: to,
            content: text,
            sentAt: null,
          },
        })
        .catch((logErr) =>
          this.logger.error(
            logErr,
            `Fallo log de error recordatorio ${appointmentId}`,
          ),
        );
      return false;
    }

    const now = new Date();
    this.logger.log(
      `Recordatorio enviado: ${appointmentId} → ${to} (${dayPhrase} ${time}hs)`,
    );

    await this.prisma.appointment.update({
      where: { id: row.id },
      data: {
        reminderSentAt: now,
        confirmationDeadline: new Date(
          now.getTime() +
            (professional.confirmationWindowMinutes ?? 60) * 60 * 1000,
        ),
      },
    });

    await this.prisma.messageLog
      .create({
        data: {
          professionalId: professional.id,
          organizationId: waCtx.organizationId,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_REMINDER,
          toPhone: to,
          content: text,
          sentAt: now,
        },
      })
      .catch((logErr) => {
        this.logger.error(
          logErr,
          `Fallo log de recordatorio enviado ${appointmentId}`,
        );
      });

    return true;
  }

  /** Respuesta automática al paciente (acuse). */
  async sendSystemText(params: {
    professionalId: string;
    patientId: string | null;
    appointmentId: string | null;
    toPhoneDigits: string;
    content: string;
    organizationId?: string | null;
  }): Promise<void> {
    if (!this.evolution.isConfigured()) return;

    const waCtx = await this.resolveEffectiveWaContext(
      params.professionalId,
      params.organizationId,
    );
    if (!waCtx.isConnected) return;

    try {
      await this.evolution.sendText(
        waCtx.instance,
        params.toPhoneDigits,
        params.content,
      );
    } catch (e) {
      this.logger.error(e, 'Fallo envío acuse WA');
      await this.prisma.messageLog
        .create({
          data: {
            professionalId: params.professionalId,
            organizationId: waCtx.organizationId,
            patientId: params.patientId,
            appointmentId: params.appointmentId,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.SYSTEM,
            toPhone: params.toPhoneDigits,
            content: params.content,
            sentAt: null,
          },
        })
        .catch((logErr) =>
          this.logger.error(logErr, 'Fallo log de error acuse WA'),
        );
      return;
    }

    await this.prisma.messageLog
      .create({
        data: {
          professionalId: params.professionalId,
          organizationId: waCtx.organizationId,
          patientId: params.patientId,
          appointmentId: params.appointmentId,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.SYSTEM,
          toPhone: params.toPhoneDigits,
          content: params.content,
          sentAt: new Date(),
        },
      })
      .catch((logErr) => {
        this.logger.error(logErr, 'Fallo log de acuse WA');
      });
  }

  async sendAppointmentRescheduled(appointmentId: string): Promise<void> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, professional: true },
    });
    if (!row) return;

    const { professional, patient } = row;
    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );

    const orgId = row.organizationId ?? undefined;

    void this.notifications
      .create({
        professionalId: professional.id,
        organizationId: orgId,
        type: 'APPOINTMENT_RESCHEDULED',
        title: `Turno de ${patient.firstName} ${patient.lastName} reprogramado`,
        body: `Nuevo horario: ${weekday} ${dayMonth} a las ${time}hs`,
        link: `/appointments?id=${appointmentId}`,
        appointmentId,
        patientId: patient.id,
        metadata: {
          patientName: `${patient.firstName} ${patient.lastName}`,
          when: `${weekday} ${dayMonth} a las ${time}hs`,
        },
      })
      .catch((e) =>
        this.logger.error(
          `Failed to create APPOINTMENT_RESCHEDULED notification: ${e}`,
        ),
      );

    if (!this.evolution.isConfigured()) return;

    const waCtx = await this.resolveEffectiveWaContext(professional.id, orgId);
    if (!waCtx.isConnected) return;
    if (!patient.phone) return;

    const tpl = await this.getTemplate(
      professional.id,
      MessageType.APPOINTMENT_RESCHEDULED,
      waCtx.organizationId,
    );
    if (!tpl.isEnabled) return;

    const text = this.interpolate(tpl.body, {
      nombrePaciente: patient.firstName ?? '',
      nombreProfesional: professional.fullName ?? '',
      diaSemana: weekday,
      fechaMes: dayMonth,
      hora: time,
    });

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(waCtx.instance, to, text);
    } catch (e) {
      this.logger.error(e, `Fallo envío WA reprogramación ${appointmentId}`);
      await this.prisma.messageLog
        .create({
          data: {
            professionalId: professional.id,
            organizationId: waCtx.organizationId,
            patientId: patient.id,
            appointmentId: row.id,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.APPOINTMENT_RESCHEDULED,
            toPhone: to,
            content: text,
            sentAt: null,
          },
        })
        .catch((logErr) =>
          this.logger.error(
            logErr,
            `Fallo log de error reprogramación ${appointmentId}`,
          ),
        );
      return;
    }

    await this.prisma.messageLog
      .create({
        data: {
          professionalId: professional.id,
          organizationId: waCtx.organizationId,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_RESCHEDULED,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      })
      .catch((logErr) => {
        this.logger.error(
          logErr,
          `Fallo log de reprogramación ${appointmentId}`,
        );
      });
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
    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );

    const orgId = row.organizationId ?? undefined;

    void this.notifications
      .create({
        professionalId: professional.id,
        organizationId: orgId,
        type: 'APPOINTMENT_CANCELLED_SENT',
        title: `Turno de ${patient.firstName} ${patient.lastName} cancelado`,
        body: `${weekday} ${dayMonth} a las ${time}hs`,
        link: `/appointments?id=${appointmentId}`,
        appointmentId,
        patientId: patient.id,
        metadata: {
          patientName: `${patient.firstName} ${patient.lastName}`,
          when: `${weekday} ${dayMonth} a las ${time}hs`,
        },
      })
      .catch((e) =>
        this.logger.error(
          `Failed to create APPOINTMENT_CANCELLED_SENT notification: ${e}`,
        ),
      );

    if (!this.evolution.isConfigured()) return;

    const waCtx = await this.resolveEffectiveWaContext(professional.id, orgId);
    if (!waCtx.isConnected) return;
    if (!patient.phone) return;

    const tpl = await this.getTemplate(
      professional.id,
      MessageType.APPOINTMENT_CANCELLED,
      waCtx.organizationId,
    );
    if (!tpl.isEnabled) return;

    const text = this.interpolate(tpl.body, {
      nombrePaciente: patient.firstName ?? '',
      nombreProfesional: professional.fullName ?? '',
      diaSemana: weekday,
      fechaMes: dayMonth,
      hora: time,
    });

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(waCtx.instance, to, text);
    } catch (e) {
      this.logger.error(e, `Fallo envío WA cancelación ${appointmentId}`);
      await this.prisma.messageLog
        .create({
          data: {
            professionalId: professional.id,
            organizationId: waCtx.organizationId,
            patientId: patient.id,
            appointmentId: row.id,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.APPOINTMENT_CANCELLED,
            toPhone: to,
            content: text,
            sentAt: null,
          },
        })
        .catch((logErr) =>
          this.logger.error(
            logErr,
            `Fallo log de error cancelación ${appointmentId}`,
          ),
        );
      return;
    }

    await this.prisma.messageLog
      .create({
        data: {
          professionalId: professional.id,
          organizationId: waCtx.organizationId,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.APPOINTMENT_CANCELLED,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      })
      .catch((logErr) => {
        this.logger.error(logErr, `Fallo log de cancelación ${appointmentId}`);
      });
  }

  async sendDailyDigestToProfessional(
    professionalId: string,
  ): Promise<boolean> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        timezone: true,
      },
    });

    if (!professional?.phone) return false;
    if (!this.evolution.isConfigured()) return false;

    const waCtx = await this.resolveEffectiveWaContext(professionalId);
    if (!waCtx.isConnected) return false;

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
          waCtx.instance,
          normalizeArWhatsappNumber(professional.phone),
          text,
        );
        await this.prisma.messageLog.create({
          data: {
            professionalId,
            organizationId: waCtx.organizationId,
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
        waCtx.instance,
        normalizeArWhatsappNumber(professional.phone),
        text,
      );
      await this.prisma.messageLog.create({
        data: {
          professionalId,
          organizationId: waCtx.organizationId,
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
    if (!this.evolution.isConfigured()) return;

    const waCtx = await this.resolveEffectiveWaContext(
      professional.id,
      row.organizationId,
    );
    if (!waCtx.isConnected) return;
    if (!patient.phone) return;

    const { weekday, dayMonth, time } = formatAppointmentHuman(
      row.startAt,
      professional.timezone,
    );
    const fee = row.revenue?.amount ?? row.fee;
    const feeFormatted = Number(fee).toLocaleString('es-AR');

    const tpl = await this.getTemplate(
      professional.id,
      MessageType.PAYMENT_REMINDER,
      waCtx.organizationId,
    );
    if (!tpl.isEnabled) return;

    const text = this.interpolate(tpl.body, {
      nombrePaciente: patient.firstName ?? '',
      nombreProfesional: professional.fullName ?? '',
      diaSemana: weekday,
      fechaMes: dayMonth,
      hora: time,
      monto: feeFormatted,
      aliasPago: professional.paymentAlias ?? '',
    });

    const to = normalizeArWhatsappNumber(patient.phone);
    try {
      await this.evolution.sendText(waCtx.instance, to, text);
    } catch (e) {
      this.logger.error(e, `Fallo envío recordatorio pago ${appointmentId}`);
      await this.prisma.messageLog
        .create({
          data: {
            professionalId: professional.id,
            organizationId: waCtx.organizationId,
            patientId: patient.id,
            appointmentId: row.id,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.PAYMENT_REMINDER,
            toPhone: to,
            content: text,
            sentAt: null,
          },
        })
        .catch((logErr) =>
          this.logger.error(logErr, `Fallo log de error pago ${appointmentId}`),
        );
      return;
    }

    await this.prisma.messageLog
      .create({
        data: {
          professionalId: professional.id,
          organizationId: waCtx.organizationId,
          patientId: patient.id,
          appointmentId: row.id,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.PAYMENT_REMINDER,
          toPhone: to,
          content: text,
          sentAt: new Date(),
        },
      })
      .catch((logErr) => {
        this.logger.error(
          logErr,
          `Fallo log de recordatorio pago ${appointmentId}`,
        );
      });
  }

  /**
   * Resuelve profesional + paciente a partir de una instancia WA y un teléfono entrante.
   * Para instancias de centro (cymple-org-*), busca entre todos los profesionales del centro.
   */
  private async resolveReplyContext(
    instanceName: string,
    fromJidDigits: string,
  ): Promise<{
    professional: {
      id: string;
      fullName: string;
      timezone: string;
      phone: string | null;
    };
    patient: { id: string; phone: string; firstName: string; lastName: string };
    organizationId: string | undefined;
  } | null> {
    // Instancia de centro: buscar entre todos los profesionales del centro
    if (instanceName.startsWith('cymple-org-')) {
      const orgId = instanceName.slice('cymple-org-'.length);
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      if (!org) {
        this.logger.warn(`resolveReplyContext: org ${orgId} not found`);
        return null;
      }

      const profs = await this.prisma.professional.findMany({
        where: { organizationId: orgId },
        select: { id: true, fullName: true, timezone: true, phone: true },
      });
      if (!profs.length) {
        this.logger.warn(
          `resolveReplyContext: no professionals found for org ${orgId}`,
        );
        return null;
      }

      const profIds = profs.map((p) => p.id);
      const patients = await this.prisma.patient.findMany({
        where: {
          deletedAt: null,
          OR: [{ professionalId: { in: profIds } }, { organizationId: orgId }],
        },
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          professionalId: true,
        },
      });

      this.logger.debug(
        `resolveReplyContext[org]: fromJid=${fromJidDigits}, profs=${profs.length}, patients=${patients.length}`,
      );

      const patient = patients.find(
        (p) => p.phone && phonesMatch(p.phone, fromJidDigits),
      );

      if (!patient) {
        const last8 = fromJidDigits.slice(-8);
        const last10 = fromJidDigits.slice(-10);
        this.logger.warn(
          `resolveReplyContext[org]: no in-memory match for ${maskPhone(fromJidDigits)}. Trying DB fallback with last8=${last8}, last10=${last10}`,
        );
        const fallback = await this.prisma.patient.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { professionalId: { in: profIds } },
              { organizationId: orgId },
            ],
            phone: {
              endsWith: last8.length >= 8 ? last8 : last10,
            },
          },
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            professionalId: true,
          },
        });
        if (fallback) {
          this.logger.log(
            `resolveReplyContext[org]: DB fallback matched patient ${fallback.firstName} ${fallback.lastName} (stored phone: ${maskPhone(fallback.phone!)}) for incoming ${maskPhone(fromJidDigits)}`,
          );
          let matchedPro = profs.find((p) => p.id === fallback.professionalId);
          if (!matchedPro && (!fallback.professionalId || profs.length > 0)) {
            const recentApt = await this.prisma.appointment.findFirst({
              where: {
                patientId: fallback.id,
                professionalId: { in: profIds },
                status: {
                  in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
                },
                reminderSentAt: { not: null },
              },
              orderBy: { startAt: 'asc' },
              select: { professionalId: true },
            });
            if (recentApt) {
              matchedPro = profs.find((p) => p.id === recentApt.professionalId);
            }
          }
          if (!matchedPro && (!fallback.professionalId || profs.length > 0)) {
            const anyApt = await this.prisma.appointment.findFirst({
              where: {
                patientId: fallback.id,
                professionalId: { in: profIds },
                status: {
                  in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
                },
              },
              orderBy: { startAt: 'asc' },
              select: { professionalId: true },
            });
            if (anyApt) {
              matchedPro = profs.find((p) => p.id === anyApt.professionalId);
            }
          }
          if (!matchedPro) {
            this.logger.warn(
              `resolveReplyContext: no professional found for fallback patient ${fallback.id}`,
            );
            return null;
          }
          return {
            professional: matchedPro,
            patient: { ...fallback, phone: fallback.phone! },
            organizationId: orgId,
          };
        }

        const storedPhones = patients
          .filter((p) => p.phone)
          .map((p) => `${p.firstName}:${maskPhone(p.phone!)}`);
        this.logger.warn(
          `resolveReplyContext: no patient match at all for incoming=${maskPhone(fromJidDigits)}. Stored phones count: ${storedPhones.length}`,
        );
        return null;
      }

      let professional = profs.find((p) => p.id === patient.professionalId);
      if (!professional) {
        if (
          patient.professionalId === null ||
          patient.professionalId === undefined
        ) {
          const recentAppointment = await this.prisma.appointment.findFirst({
            where: {
              patientId: patient.id,
              professionalId: { in: profIds },
              status: {
                in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
              },
              reminderSentAt: { not: null },
            },
            orderBy: { startAt: 'asc' },
            select: { professionalId: true },
          });
          if (recentAppointment) {
            professional = profs.find(
              (p) => p.id === recentAppointment.professionalId,
            );
          }
          if (!professional) {
            const anyAppointment = await this.prisma.appointment.findFirst({
              where: {
                patientId: patient.id,
                professionalId: { in: profIds },
                status: {
                  in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
                },
              },
              orderBy: { startAt: 'asc' },
              select: { professionalId: true },
            });
            if (anyAppointment) {
              professional = profs.find(
                (p) => p.id === anyAppointment.professionalId,
              );
            }
          }
        } else {
          this.logger.warn(
            `resolveReplyContext: professional ${patient.professionalId} not found for patient ${patient.id}`,
          );
          return null;
        }
      }

      if (!professional) {
        this.logger.warn(
          `resolveReplyContext[org]: could not resolve professional for patient ${patient.id}`,
        );
        return null;
      }

      this.logger.log(
        `resolveReplyContext[org]: matched patient ${patient.firstName} ${patient.lastName} → professional ${professional.fullName}`,
      );

      return {
        professional,
        patient: { ...patient, phone: patient.phone! },
        organizationId: orgId,
      };
    }

    // Instancia de profesional independiente
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
      this.logger.warn(
        `resolveReplyContext: no professional found for instance ${instanceName}`,
      );
      return null;
    }

    const patients = await this.prisma.patient.findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    this.logger.debug(
      `resolveReplyContext[prof]: fromJid=${fromJidDigits}, professional=${professional.fullName}, patients=${patients.length}`,
    );

    const patient = patients.find(
      (p) => p.phone && phonesMatch(p.phone, fromJidDigits),
    );

    if (!patient || !patient.phone) {
      const last8 = fromJidDigits.slice(-8);
      const last10 = fromJidDigits.slice(-10);
      this.logger.warn(
        `resolveReplyContext[prof]: no in-memory match for ${maskPhone(fromJidDigits)}. Trying DB fallback`,
      );
      const fallback = await this.prisma.patient.findFirst({
        where: {
          professionalId: professional.id,
          deletedAt: null,
          OR: [{ phone: { endsWith: last8 } }, { phone: { endsWith: last10 } }],
        },
        select: { id: true, phone: true, firstName: true, lastName: true },
      });
      if (fallback && fallback.phone) {
        this.logger.log(
          `resolveReplyContext[prof]: DB fallback matched patient ${fallback.firstName} ${fallback.lastName} (stored: ${maskPhone(fallback.phone)}) for incoming ${maskPhone(fromJidDigits)}`,
        );
        return {
          professional,
          patient: { ...fallback, phone: fallback.phone },
          organizationId: undefined,
        };
      }

      const storedPhones = patients
        .filter((p) => p.phone)
        .map((p) => `${p.firstName}:${maskPhone(p.phone!)}`);
      this.logger.warn(
        `resolveReplyContext: no patient match at all for incoming=${maskPhone(fromJidDigits)} among ${patients.length} patients of ${professional.fullName}. Stored phones count: ${storedPhones.length}`,
      );
      return null;
    }

    this.logger.log(
      `resolveReplyContext[prof]: matched patient ${patient.firstName} ${patient.lastName} → professional ${professional.fullName}`,
    );

    return {
      professional,
      patient: { ...patient, phone: patient.phone },
      organizationId: undefined,
    };
  }

  async processPatientReply(
    instanceName: string,
    fromJidDigits: string,
    rawText: string,
  ): Promise<boolean> {
    const normalized = rawText.trim();

    const isOne =
      normalized === '1' ||
      /^1\uFE0F\u20E3/.test(normalized) ||
      /^\s*(s[ií]|confirmo|ok|voy|dale|vale|claro|perfecto|ah[ií] estoy)\s*$/i.test(
        normalized,
      );
    const isTwo =
      normalized === '2' ||
      /^2\uFE0F\u20E3/.test(normalized) ||
      /^\s*(cancelo|cancelar|no puedo|no voy|imposible)\s*$/i.test(normalized);

    const resolved = await this.resolveReplyContext(
      instanceName,
      fromJidDigits,
    );
    if (!resolved) {
      this.logger.warn(
        `processPatientReply: could not resolve context for instance=${instanceName}, fromJid=${maskPhone(fromJidDigits)}, text="${rawText.substring(0, 50)}"`,
      );
      let notifyProfessionalId: string | undefined;
      let notifyOrganizationId: string | undefined;
      if (instanceName.startsWith('cymple-org-')) {
        notifyOrganizationId = instanceName.slice('cymple-org-'.length);
      } else if (instanceName.startsWith('cymple-prof-')) {
        notifyProfessionalId = instanceName.slice('cymple-prof-'.length);
      }
      if (notifyProfessionalId || notifyOrganizationId) {
        void this.notifications
          .create({
            professionalId: notifyProfessionalId,
            organizationId: notifyOrganizationId,
            type: 'WA_UNKNOWN_REPLY',
            title: 'Mensaje de WhatsApp no identificado',
            body: `Recibiste un mensaje de ${maskPhone(fromJidDigits)} que no se pudo asociar a ningún paciente: "${rawText.substring(0, 80)}"`,
            link: '/messages',
            metadata: {
              fromPhone: fromJidDigits,
              rawText: rawText.substring(0, 200),
            },
          })
          .catch((e) =>
            this.logger.error(
              `Failed to create WA_UNKNOWN_REPLY notification: ${e}`,
            ),
          );
      }
      return false;
    }

    const { professional, patient, organizationId } = resolved;

    const inboundLog = await this.prisma.messageLog.create({
      data: {
        professionalId: professional.id,
        organizationId,
        patientId: patient.id,
        direction: MessageDirection.INBOUND,
        messageType: MessageType.PATIENT_REPLY,
        fromPhone: fromJidDigits,
        content: rawText,
        receivedAt: new Date(),
      },
    });

    // Respuesta no reconocida: guiar amablemente al paciente
    if (!isOne && !isTwo) {
      const guidance =
        `Hola ${patient.firstName} \u{1F44B}, soy el *asistente virtual de turnos* de ${professional.fullName}.\n\n` +
        `No soy ${professional.fullName.split(' ')[0]}, solo gestiono sus turnos automáticamente. \u{1F916}\n\n` +
        `Por favor respondé solo con:\n` +
        `1\uFE0F\u20E3 para *confirmar* tu turno\n` +
        `2\uFE0F\u20E3 para *cancelarlo*\n\n` +
        `Si necesitás hablar directamente con ${professional.fullName.split(' ')[0]}, contactalo por otro medio. \u{1F64F}`;
      await this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: null,
        toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
        content: guidance,
        organizationId,
      });
      return true;
    }

    const now = new Date();
    const gracePeriod = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const futureLimit = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const remindedCandidates = await this.prisma.appointment.findMany({
      where: {
        professionalId: professional.id,
        patientId: patient.id,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: { gte: gracePeriod, lte: futureLimit },
        reminderSentAt: { not: null },
      },
      orderBy: { startAt: 'asc' },
    });

    if (remindedCandidates.length > 1) {
      this.logger.warn(
        `Ambiguous reply: patient ${patient.id} has ${remindedCandidates.length} upcoming reminded appointments. Selecting earliest.`,
      );
    }

    let appointment = remindedCandidates[0];

    if (!appointment) {
      const allCandidates = await this.prisma.appointment.findMany({
        where: {
          professionalId: professional.id,
          patientId: patient.id,
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          startAt: { gte: gracePeriod },
        },
        orderBy: { startAt: 'asc' },
      });

      if (allCandidates.length > 1) {
        this.logger.warn(
          `Ambiguous reply (no reminder): patient ${patient.id} has ${allCandidates.length} upcoming appointments.`,
        );
      }

      appointment = allCandidates[0];
    }

    if (!appointment) {
      this.logger.warn(
        `No upcoming appointment found for patient ${patient.id} (${patient.firstName} ${patient.lastName}) from phone ${maskPhone(fromJidDigits)}`,
      );
      const guidance =
        `Hola ${patient.firstName} \u{1F44B}, soy el *asistente virtual de turnos* de ${professional.fullName}.\n\n` +
        `No encontré un turno pendiente para vos. Si querés agendar uno, contactá directamente a ${professional.fullName}.\n\n` +
        `1\uFE0F\u20E3 Confirmar turno\n` +
        `2\uFE0F\u20E3 Cancelar turno`;
      await this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: null,
        toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
        content: guidance,
        organizationId,
      });
      return true;
    }

    const { time } = formatAppointmentHuman(
      appointment.startAt,
      professional.timezone,
    );
    const rel = reminderRelativeDay(appointment.startAt, professional.timezone);
    const whenLabel =
      rel ||
      formatAppointmentHuman(appointment.startAt, professional.timezone)
        .weekday;

    const freshAppointment = await this.prisma.appointment.findUnique({
      where: { id: appointment.id },
      select: { status: true },
    });

    if (isOne) {
      if (
        freshAppointment &&
        freshAppointment.status === AppointmentStatus.CONFIRMED
      ) {
        const fechaCorta = new Intl.DateTimeFormat('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: professional.timezone,
        }).format(appointment.startAt);
        const ack =
          `Hola ${patient.firstName}, tu turno ya estaba confirmado \u{2705}\n` +
          `\u{1F4C5} ${fechaCorta} a las ${time} hs con ${professional.fullName}.\n\n` +
          `¡Te esperamos!`;
        await this.sendSystemText({
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: appointment.id,
          toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
          content: ack,
          organizationId,
        });
        return true;
      }

      const updateResult = await this.prisma.appointment.updateMany({
        where: {
          id: appointment.id,
          status: AppointmentStatus.PENDING,
        },
        data: {
          status: AppointmentStatus.CONFIRMED,
          confirmationDeadline: null,
        },
      });

      if (updateResult.count === 0) {
        this.logger.warn(
          `Appointment ${appointment.id} confirm race lost — status is now ${freshAppointment?.status}. Sending already-confirmed reply.`,
        );
        const fechaCorta = new Intl.DateTimeFormat('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: professional.timezone,
        }).format(appointment.startAt);
        const oneHourAfter = new Date(
          appointment.startAt.getTime() + 60 * 60 * 1000,
        );
        const nextAptRace = await this.prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            professionalId: professional.id,
            id: { not: appointment.id },
            status: {
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
            },
            startAt: { gt: appointment.startAt, lte: oneHourAfter },
          },
          orderBy: { startAt: 'asc' },
          select: { startAt: true },
        });
        let nextAptLineRace = '';
        if (nextAptRace) {
          const nextTime = new Intl.DateTimeFormat('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: professional.timezone,
          }).format(nextAptRace.startAt);
          nextAptLineRace = `\n\n\u{1F4C5} Tenés otro turno a las ${nextTime} hs — también podés confirmarlo respondiendo 1.`;
        }
        const ack =
          `Hola ${patient.firstName}, tu turno ya estaba confirmado \u{2705}\n` +
          `\u{1F4C5} ${fechaCorta} a las ${time} hs con ${professional.fullName}.` +
          nextAptLineRace +
          `\n\n¡Te esperamos!`;
        await this.sendSystemText({
          professionalId: professional.id,
          patientId: patient.id,
          appointmentId: appointment.id,
          toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
          content: ack,
          organizationId,
        });
        return true;
      }

      if (inboundLog) {
        await this.prisma.messageLog
          .update({
            where: { id: inboundLog.id },
            data: { appointmentId: appointment.id },
          })
          .catch(() => {});
      }

      const fechaCorta = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: professional.timezone,
      }).format(appointment.startAt);

      const oneHourAfter = new Date(
        appointment.startAt.getTime() + 60 * 60 * 1000,
      );
      const nextApt = await this.prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          professionalId: professional.id,
          id: { not: appointment.id },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          startAt: { gt: appointment.startAt, lte: oneHourAfter },
        },
        orderBy: { startAt: 'asc' },
        select: { startAt: true },
      });

      let nextAptLine = '';
      if (nextApt) {
        const nextTime = new Intl.DateTimeFormat('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: professional.timezone,
        }).format(nextApt.startAt);
        nextAptLine = `\n\n\u{1F4C5} Tenés otro turno a las ${nextTime} hs — también podés confirmarlo respondiendo 1.`;
      }

      const ack =
        `\u{2705} ¡Listo, ${patient.firstName}! Tu turno quedó confirmado:\n` +
        `\u{1F4C5} ${fechaCorta} a las ${time} hs con ${professional.fullName}.` +
        nextAptLine +
        `\n\n¡Te esperamos! Si necesitás algo antes, escribinos por acá.`;
      await this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: appointment.id,
        toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
        content: ack,
        organizationId,
      });

      const patientName = `${patient.firstName} ${patient.lastName}`;
      const notifBody = `${rel ? rel : whenLabel} a las ${time}hs`;
      void this.notifications
        .create({
          professionalId: professional.id,
          organizationId,
          type: 'PATIENT_CONFIRMED',
          title: `${patientName} confirmó su turno`,
          body: notifBody,
          link: `/appointments?id=${appointment.id}`,
          appointmentId: appointment.id,
          patientId: patient.id,
          metadata: { patientName, when: notifBody },
        })
        .catch((e) =>
          this.logger.error(
            `Failed to create PATIENT_CONFIRMED notification: ${e}`,
          ),
        );

      return true;
    }

    if (
      freshAppointment &&
      freshAppointment.status === AppointmentStatus.CANCELLED
    ) {
      const ack = `Hola ${patient.firstName}, ese turno ya fue cancelado previamente. \u{1F44B}`;
      await this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: appointment.id,
        toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
        content: ack,
        organizationId,
      });
      return true;
    }

    const cancelResult = await this.prisma.appointment.updateMany({
      where: {
        id: appointment.id,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        confirmationDeadline: null,
      },
    });

    if (cancelResult.count === 0) {
      this.logger.warn(
        `Appointment ${appointment.id} cancel race lost — status is now ${freshAppointment?.status}. Sending already-processed reply.`,
      );
      const statusLabel =
        freshAppointment?.status === AppointmentStatus.CANCELLED
          ? 'cancelado'
          : 'confirmado';
      const ack =
        freshAppointment?.status === AppointmentStatus.CANCELLED
          ? `Hola ${patient.firstName}, ese turno ya fue cancelado previamente. \u{1F44B}`
          : `Hola ${patient.firstName}, no se puede cancelar un turno que ya fue ${statusLabel}. Si necesitás cancelarlo, contactá directamente a ${professional.fullName}.`;
      await this.sendSystemText({
        professionalId: professional.id,
        patientId: patient.id,
        appointmentId: appointment.id,
        toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
        content: ack,
        organizationId,
      });
      return true;
    }

    if (inboundLog) {
      await this.prisma.messageLog
        .update({
          where: { id: inboundLog.id },
          data: { appointmentId: appointment.id },
        })
        .catch(() => {});
    }

    const ack = `Entendido, ${patient.firstName}. Tu turno fue cancelado. ¡Hasta la próxima! \u{1F44B}`;
    await this.sendSystemText({
      professionalId: professional.id,
      patientId: patient.id,
      appointmentId: appointment.id,
      toPhoneDigits: normalizeArWhatsappNumber(patient.phone),
      content: ack,
      organizationId,
    });

    const patientName = `${patient.firstName} ${patient.lastName}`;
    const notifBody = `${rel ? rel : whenLabel} a las ${time}hs`;
    void this.notifications
      .create({
        professionalId: professional.id,
        organizationId,
        type: 'PATIENT_CANCELLED',
        title: `${patientName} canceló su turno`,
        body: notifBody,
        link: `/appointments?id=${appointment.id}`,
        appointmentId: appointment.id,
        patientId: patient.id,
        metadata: { patientName, when: notifBody },
      })
      .catch((e) =>
        this.logger.error(
          `Failed to create PATIENT_CANCELLED notification: ${e}`,
        ),
      );

    return true;
  }
}
