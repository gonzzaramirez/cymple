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
import {
  AntiBanGuard,
  AntiBanState,
  calculateTypingDelay,
  varyMessageContent,
} from './antiban-guard';
import {
  AntiBanStateService,
  WaEntityRef,
} from './antiban-state.service';

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

export function isStrictStructuredCommand(
  input: string,
): 'CONFIRM' | 'CANCEL' | null {
  const normalized = input.trim();
  if (normalized === '1' || normalized === '1️⃣') return 'CONFIRM';
  if (normalized === '2' || normalized === '2️⃣') return 'CANCEL';
  return null;
}

function buildMessageLink(params: {
  patientId?: string | null;
  organizationId?: string;
}): string {
  if (!params.patientId) {
    return params.organizationId ? '/center/messages' : '/messages';
  }
  return params.organizationId
    ? `/center/messages/${params.patientId}`
    : `/messages/${params.patientId}`;
}

function truncateForNotification(content: string, max = 60): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Nuevo mensaje recibido';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

@Injectable()
export class WhatsappMessagingService {
  private readonly logger = new Logger(WhatsappMessagingService.name);

  private readonly antiBanGuard = new AntiBanGuard();

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionApiService,
    private readonly notifications: NotificationsService,
    private readonly messageTemplates: MessageTemplatesService,
    private readonly antiBanState: AntiBanStateService,
  ) {}

  /**
   * Envía un mensaje de texto a través de Evolution API con protección anti-ban:
   * 1. Mutex FIFO por entidad (professional/org)
   * 2. Límite diario con warm-up para números nuevos
   * 3. Cooldown aleatorio entre mensajes (8-15s / 16-30s en soft limit)
   * 4. Circuit breaker ante señales de ban
   * 5. Persistencia del estado en DB
   */
  private async sendTextWithAntiBan(
    professionalId: string,
    organizationId: string | undefined,
    instanceName: string,
    to: string,
    text: string,
  ): Promise<void> {
    const ref: WaEntityRef = organizationId
      ? { type: 'organization', id: organizationId }
      : { type: 'professional', id: professionalId };

    await this.antiBanState.runSerialized(ref, async () => {
      const state = await this.antiBanState.loadState(ref);

      this.antiBanGuard.assertCanSend(state);

      // ── Wait for cooldown since last message ───────────────
      const cooldownMs = this.antiBanGuard.getCooldownMs(state);
      if (cooldownMs > 0) {
        this.logger.debug(
          `[AntiBan] ${ref.type}:${ref.id} cooldown ${cooldownMs}ms`,
        );
        await new Promise((r) => setTimeout(r, cooldownMs));
      }

      // ── Content variation (subtle, invisible) ──────────────
      const variedText = varyMessageContent(text, to);

      // ── Typing delay proportional to message length ────────
      const typingDelay = calculateTypingDelay(variedText);

      try {
        await this.evolution.sendText(instanceName, to, variedText, { delay: typingDelay });
        this.antiBanGuard.recordSuccess(state);

        const dailyCount = state.dailyMessageCount;
        const dailyLimit = state.effectiveDailyLimit;
        if (dailyCount % 5 === 0 || dailyCount === dailyLimit) {
          this.logger.log(
            `[AntiBan] ${ref.type}:${ref.id} enviado (${dailyCount}/${dailyLimit}, typing ${typingDelay}ms)`,
          );
        }
      } catch (error: any) {
        if (this.antiBanGuard.isBanSignalError(error.message)) {
          this.antiBanGuard.recordBanSignal(state);
          this.logger.warn(
            `[AntiBan] ${ref.type}:${ref.id} ban signal detectado: ${error.message}`,
          );
        }
        throw error;
      } finally {
        await this.antiBanState.persistState(ref, state);
      }
    });
  }

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
    await this.sendTextWithAntiBan(
      professional.id,
      waCtx.organizationId,
      waCtx.instance,
      to,
      text,
    );

    await this.prisma.messageLog.create({
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
      return false;
    }

    const { professional, patient } = row;
    if (!this.evolution.isConfigured()) {
      return false;
    }

    const waCtx = await this.resolveEffectiveWaContext(
      professional.id,
      row.organizationId,
    );
    if (!waCtx.isConnected) {
      return false;
    }
    if (!patient.phone) {
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
    await this.sendTextWithAntiBan(
      professional.id,
      waCtx.organizationId,
      waCtx.instance,
      to,
      text,
    );

    const now = new Date();

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

    await this.prisma.messageLog.create({
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

    await this.sendTextWithAntiBan(
      params.professionalId,
      waCtx.organizationId,
      waCtx.instance,
      params.toPhoneDigits,
      params.content,
    );

    await this.prisma.messageLog.create({
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

    void this.notifications.create({
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
    });

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
    await this.sendTextWithAntiBan(
      professional.id,
      waCtx.organizationId,
      waCtx.instance,
      to,
      text,
    );

    await this.prisma.messageLog.create({
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

    void this.notifications.create({
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
    });

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
    await this.sendTextWithAntiBan(
      professional.id,
      waCtx.organizationId,
      waCtx.instance,
      to,
      text,
    );

    await this.prisma.messageLog.create({
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
      const digestTo = normalizeArWhatsappNumber(professional.phone);
      await this.sendTextWithAntiBan(
        professionalId,
        waCtx.organizationId,
        waCtx.instance,
        digestTo,
        text,
      );
      await this.prisma.messageLog.create({
        data: {
          professionalId,
          organizationId: waCtx.organizationId,
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.SYSTEM,
          toPhone: digestTo,
          content: text,
          sentAt: new Date(),
        },
      });
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

    const digestTo = normalizeArWhatsappNumber(professional.phone);
    await this.sendTextWithAntiBan(
      professionalId,
      waCtx.organizationId,
      waCtx.instance,
      digestTo,
      text,
    );
    await this.prisma.messageLog.create({
      data: {
        professionalId,
        organizationId: waCtx.organizationId,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.SYSTEM,
        toPhone: digestTo,
        content: text,
        sentAt: new Date(),
      },
    });
    return true;
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
    await this.sendTextWithAntiBan(
      professional.id,
      waCtx.organizationId,
      waCtx.instance,
      to,
      text,
    );

    await this.prisma.messageLog.create({
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
        return null;
      }

      const profs = await this.prisma.professional.findMany({
        where: { organizationId: orgId },
        select: { id: true, fullName: true, timezone: true, phone: true },
      });
      if (!profs.length) {
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

      const patient = patients.find(
        (p) => p.phone && phonesMatch(p.phone, fromJidDigits),
      );

      if (!patient) {
        const last8 = fromJidDigits.slice(-8);
        const last10 = fromJidDigits.slice(-10);
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
            return null;
          }
          return {
            professional: matchedPro,
            patient: { ...fallback, phone: fallback.phone! },
            organizationId: orgId,
          };
        }

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
          return null;
        }
      }

      if (!professional) {
        return null;
      }

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
      return null;
    }

    const patients = await this.prisma.patient.findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    const patient = patients.find(
      (p) => p.phone && phonesMatch(p.phone, fromJidDigits),
    );

    if (!patient || !patient.phone) {
      const last8 = fromJidDigits.slice(-8);
      const last10 = fromJidDigits.slice(-10);
      const fallback = await this.prisma.patient.findFirst({
        where: {
          professionalId: professional.id,
          deletedAt: null,
          OR: [{ phone: { endsWith: last8 } }, { phone: { endsWith: last10 } }],
        },
        select: { id: true, phone: true, firstName: true, lastName: true },
      });
      if (fallback && fallback.phone) {
        return {
          professional,
          patient: { ...fallback, phone: fallback.phone },
          organizationId: undefined,
        };
      }

      return null;
    }

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
    options?: {
      mediaType?: string;
      isStructuredText?: boolean;
      previewText?: string;
    },
  ): Promise<boolean> {
    const normalized = rawText.trim();
    const command = isStrictStructuredCommand(normalized);
    const isOne = command === 'CONFIRM';
    const isTwo = command === 'CANCEL';
    const inboundPreview = options?.previewText ?? normalized;
    const inboundIsStructuredText = options?.isStructuredText ?? true;
    const inboundMediaType = options?.mediaType;

    const resolved = await this.resolveReplyContext(
      instanceName,
      fromJidDigits,
    );
    if (!resolved) {
      let notifyProfessionalId: string | undefined;
      let notifyOrganizationId: string | undefined;
      if (instanceName.startsWith('cymple-org-')) {
        notifyOrganizationId = instanceName.slice('cymple-org-'.length);
      } else if (instanceName.startsWith('cymple-prof-')) {
        notifyProfessionalId = instanceName.slice('cymple-prof-'.length);
      }
      const unknownProfessionalId =
        notifyProfessionalId ??
        (notifyOrganizationId
          ? (
              await this.prisma.professional.findFirst({
                where: { organizationId: notifyOrganizationId },
                select: { id: true },
                orderBy: { createdAt: 'asc' },
              })
            )?.id
          : undefined);
      if (unknownProfessionalId) {
        await this.prisma.messageLog.create({
          data: {
            professionalId: unknownProfessionalId,
            organizationId: notifyOrganizationId,
            patientId: null,
            direction: MessageDirection.INBOUND,
            messageType: MessageType.PATIENT_REPLY,
            fromPhone: fromJidDigits,
            content: rawText,
            receivedAt: new Date(),
          },
        });
      }
      if (notifyProfessionalId || notifyOrganizationId) {
        const bodyText = truncateForNotification(
          inboundIsStructuredText
            ? inboundPreview
            : (options?.previewText ?? 'Nuevo archivo multimedia recibido'),
        );
        void this.notifications.create({
          professionalId: notifyProfessionalId,
          organizationId: notifyOrganizationId,
          type: 'WA_UNKNOWN_REPLY',
          title: 'Mensaje de WhatsApp no identificado',
          body: bodyText,
          link: buildMessageLink({ organizationId: notifyOrganizationId }),
          metadata: {
            fromPhone: fromJidDigits,
            rawText: rawText.substring(0, 2000),
            mediaType: inboundMediaType ?? null,
          },
        });
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

    // Texto libre o multimedia: modo pasivo, sin respuesta automática.
    if (!isOne && !isTwo) {
      void this.notifications.create({
        professionalId: professional.id,
        organizationId,
        type: 'NEW_INBOUND_MESSAGE',
        title: `Nuevo mensaje de ${patient.firstName} ${patient.lastName}`,
        body: truncateForNotification(
          inboundIsStructuredText
            ? inboundPreview
            : (options?.previewText ?? 'Nuevo archivo multimedia recibido'),
        ),
        link: buildMessageLink({
          patientId: patient.id,
          organizationId,
        }),
        patientId: patient.id,
        metadata: {
          patientId: patient.id,
          fromPhone: fromJidDigits,
          rawText: rawText.substring(0, 2000),
          mediaType: inboundMediaType ?? null,
        },
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
        status: AppointmentStatus.PENDING,
        startAt: { gte: gracePeriod, lte: futureLimit },
        reminderSentAt: { not: null },
      },
      orderBy: { startAt: 'asc' },
    });

    let appointment = remindedCandidates[0];

    if (!appointment) {
      const allCandidates = await this.prisma.appointment.findMany({
        where: {
          professionalId: professional.id,
          patientId: patient.id,
          status: AppointmentStatus.PENDING,
          startAt: { gte: gracePeriod },
        },
        orderBy: { startAt: 'asc' },
      });

      appointment = allCandidates[0];
    }

    if (!appointment) {
      const guidance = `Hola ${patient.firstName}, no hay turnos activos para confirmar o cancelar en este momento.`;
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
        const fechaCorta = new Intl.DateTimeFormat('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: professional.timezone,
        }).format(appointment.startAt);
        const fortyEightHoursAfterRace = new Date(
          appointment.startAt.getTime() + 48 * 60 * 60 * 1000,
        );
        const nextAptRace = await this.prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            professionalId: professional.id,
            id: { not: appointment.id },
            status: {
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
            },
            startAt: { gt: appointment.startAt, lte: fortyEightHoursAfterRace },
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

      const fortyEightHoursAfter = new Date(
        appointment.startAt.getTime() + 48 * 60 * 60 * 1000,
      );
      const nextApt = await this.prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          professionalId: professional.id,
          id: { not: appointment.id },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          startAt: { gt: appointment.startAt, lte: fortyEightHoursAfter },
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
      void this.notifications.create({
        professionalId: professional.id,
        organizationId,
        type: 'PATIENT_CONFIRMED',
        title: `${patientName} confirmó su turno`,
        body: notifBody,
        link: `/appointments?id=${appointment.id}`,
        appointmentId: appointment.id,
        patientId: patient.id,
        metadata: { patientName, when: notifBody },
      });

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
    void this.notifications.create({
      professionalId: professional.id,
      organizationId,
      type: 'PATIENT_CANCELLED',
      title: `${patientName} canceló su turno`,
      body: notifBody,
      link: `/appointments?id=${appointment.id}`,
      appointmentId: appointment.id,
      patientId: patient.id,
      metadata: { patientName, when: notifBody },
    });

    return true;
  }
}
