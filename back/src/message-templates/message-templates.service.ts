import { Injectable } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpsertTemplateDto } from './dto/upsert-template.dto';

export const TEMPLATABLE_TYPES = [
  MessageType.APPOINTMENT_CREATED,
  MessageType.APPOINTMENT_REMINDER,
  MessageType.APPOINTMENT_RESCHEDULED,
  MessageType.APPOINTMENT_CANCELLED,
  MessageType.PAYMENT_REMINDER,
  MessageType.BOOKING_CONFIRMED,
  MessageType.BOOKING_UNCONFIRMED_WARNING,
  MessageType.DEPOSIT_REMINDER,
  MessageType.DEPOSIT_EXPIRED,
] as const;

export type TemplatableType = (typeof TEMPLATABLE_TYPES)[number];

/**
 * 3 variantes por tipo de mensaje.
 * Se elige una al azar en cada envío para que WhatsApp no vea
 * contenido idéntico repetido (anti-ban).
 */
export const DEFAULT_TEMPLATE_VARIANTS: Record<
  TemplatableType,
  [string, string, string]
> = {
  // ── APPOINTMENT_CREATED ──────────────────────────────────
  [MessageType.APPOINTMENT_CREATED]: [
    `Hola {{nombrePaciente}}! 🗓️\n` +
      `Te confirmamos tu turno con {{nombreProfesional}}:\n` +
      `📅 {{diaSemana}}, {{fechaMes}} a las {{hora}}hs\n\n` +
      `¡Te esperamos!`,

    `¡Hola {{nombrePaciente}}! 👋\n` +
      `Tu turno fue agendado correctamente ✅\n` +
      `🗓️ Te esperamos el {{diaSemana}} {{fechaMes}} a las {{hora}}hs.\n\n` +
      `Cualquier cosa, escribinos por acá.`,

    `{{nombrePaciente}}, tenemos un turno agendado para vos.\n\n` +
      `👤 Con {{nombreProfesional}}\n` +
      `📆 {{diaSemana}}, {{fechaMes}} a las {{hora}}hs\n\n` +
      `Te esperamos! Si no podés asistir, avisanos con anticipación.`,
  ],

  // ── APPOINTMENT_REMINDER ─────────────────────────────────
  [MessageType.APPOINTMENT_REMINDER]: [
    `📋 Recordatorio de turno\n` +
      `Hola {{nombrePaciente}}! {{diaRelativo}} tenés turno con {{nombreProfesional}} a las {{hora}}hs.\n\n` +
      `Confirmá tu asistencia:\n` +
      `1️⃣ Confirmo que voy\n` +
      `2️⃣ No puedo asistir`,

    `⏰ Hola {{nombrePaciente}} 👋\n` +
      `Te recordamos que {{diaRelativo}} a las {{hora}}hs tenés turno con {{nombreProfesional}}.\n\n` +
      `Respondé para confirmar:\n` +
      `1️⃣ Sí, voy\n` +
      `2️⃣ No puedo`,

    `📌 {{nombrePaciente}}, pasamos a recordarte tu turno\n\n` +
      `👤 Con {{nombreProfesional}}\n` +
      `📅 {{diaRelativo}} a las {{hora}}hs\n\n` +
      `Por favor confirmá si vas a asistir:\n` +
      `1️⃣ Confirmo\n` +
      `2️⃣ Cancelar`,
  ],

  // ── APPOINTMENT_RESCHEDULED ──────────────────────────────
  [MessageType.APPOINTMENT_RESCHEDULED]: [
    `🔄 Tu turno fue reprogramado.\n` +
      `Nueva fecha: *{{diaSemana}}, {{fechaMes}} a las {{hora}}hs* con {{nombreProfesional}}.\n\n` +
      `📍 ¡Te esperamos!`,

    `Hola {{nombrePaciente}}! 👋\n` +
      `Te informamos que tu turno fue reprogramado.\n\n` +
      `📅 Nueva fecha: {{diaSemana}} {{fechaMes}} a las {{hora}}hs\n` +
      `👤 Con {{nombreProfesional}}\n\n` +
      `Nos vemos ahí.`,

    `🔄 {{nombrePaciente}}, tu turno cambió de fecha.\n\n` +
      `Ahora es:\n` +
      `📆 {{diaSemana}}, {{fechaMes}} a las {{hora}}hs\n` +
      `👤 Con {{nombreProfesional}}\n\n` +
      `Si no te queda bien, contactanos para reagendar.`,
  ],

  // ── APPOINTMENT_CANCELLED ────────────────────────────────
  [MessageType.APPOINTMENT_CANCELLED]: [
    `Hola {{nombrePaciente}}, tu turno del *{{diaSemana}} {{fechaMes}} a las {{hora}}hs* con {{nombreProfesional}} fue cancelado.\n\n` +
      `Contactate con nosotros para reprogramar. ¡Hasta pronto! 👋`,

    `{{nombrePaciente}}, lamentamos informarte que el turno del {{diaSemana}} {{fechaMes}} a las {{hora}}hs fue cancelado.\n\n` +
      `Si querés sacar un nuevo turno, escribinos y te ayudamos.`,

    `⛔ Hola {{nombrePaciente}}.\n` +
      `El turno de {{diaSemana}} {{fechaMes}} a las {{hora}}hs con {{nombreProfesional}} fue cancelado.\n\n` +
      `Disculpá las molestias. Si necesitas asistencia, contactanos.`,
  ],

  // ── PAYMENT_REMINDER ─────────────────────────────────────
  [MessageType.PAYMENT_REMINDER]: [
    'Hola {{nombrePaciente}}! 🤗\n\n' +
      'Muchas gracias por venir a tu sesión del *{{diaSemana}} {{fechaMes}} a las {{hora}}hs*. ' +
      'Fue un gusto atenderte 💫\n\n' +
      'Te recordamos que tenés pendiente el pago de *${{monto}}* correspondiente a esa sesión.\n' +
      '💳 Alias: *{{aliasPago}}*\n\n' +
      '_Si ya realizaste la transferencia, por favor ignorá este mensaje. 🙏_\n\n' +
      '❤️ Hasta la próxima, {{nombreProfesional}}',

    '¡Hola {{nombrePaciente}}! 👋\n\n' +
      'Esperamos que hayas disfrutado tu atención del {{diaSemana}} {{fechaMes}} 💙\n\n' +
      'Te comentamos que tenés pendiente el pago de *${{monto}}*:\n' +
      '💳 Podés transferir al alias: *{{aliasPago}}*\n\n' +
      'Si ya lo hiciste, ignorá este mensaje. ¡Gracias!',

    '{{nombrePaciente}}, buen día 🙌\n\n' +
      'Te recordamos amablemente que el pago de tu atención del {{diaSemana}} está pendiente.\n' +
      '💰 *${{monto}}*\n' +
      '💳 Alias: *{{aliasPago}}*\n\n' +
      '_Si ya abonaste, por favor desestimá este mensaje._\n\n' +
      'Saludos, {{nombreProfesional}} 🫶',
  ],

  // ── BOOKING_CONFIRMED ────────────────────────────────────
  [MessageType.BOOKING_CONFIRMED]: [
    `¡Hola {{nombrePaciente}}! 👋\n\n` +
      `✅ Tu turno quedó reservado:\n` +
      `📅 {{fechaHumana}} a las {{horario}}hs\n` +
      `👤 Con {{nombreProfesional}}\n\n` +
      `{{detalleSena}}` +
      `{{detalleFicha}}` +
      `Tu código de reserva es: {{codigoReserva}}\n\n` +
      `¡Te esperamos!`,

    `{{nombrePaciente}}, reserva confirmada ✅\n\n` +
      `🗓️ {{fechaHumana}} a las {{horario}}hs\n` +
      `👤 {{nombreProfesional}}\n\n` +
      `{{detalleSena}}` +
      `{{detalleFicha}}` +
      `Código: {{codigoReserva}}\n\n` +
      `Nos vemos pronto!`,

    `¡Hola {{nombrePaciente}}! 🎉\n` +
      `Tu turno fue reservado con éxito.\n\n` +
      `📆 Día: {{fechaHumana}}\n` +
      `⏰ Horario: {{horario}}hs\n` +
      `👤 Profesional: {{nombreProfesional}}\n\n` +
      `{{detalleSena}}` +
      `{{detalleFicha}}` +
      `📝 Código: {{codigoReserva}}\n\n` +
      `Cualquier cosa, estamos a tu disposición.`,
  ],

  // ── BOOKING_UNCONFIRMED_WARNING ──────────────────────────
  [MessageType.BOOKING_UNCONFIRMED_WARNING]: [
    `⏰ Recordatorio: tenés un turno pendiente de confirmación para el {{fechaHumana}} a las {{horario}}hs.\n\n` +
      'Por favor confirmá tu reserva respondiendo el mensaje de WhatsApp que te enviamos.\n' +
      `Si no confirmás, el turno será cancelado automáticamente.\n\n` +
      `¡Gracias!`,

    `Hola! 👋 Tenés un turno sin confirmar para el {{fechaHumana}} a las {{horario}}hs.\n\n` +
      `Recordá confirmar respondiendo el WhatsApp que te mandamos. Sin confirmación, el turno se libera automáticamente.`,

    `⏳ {{nombrePaciente}}, tu turno del {{fechaHumana}} a las {{horario}}hs sigue pendiente de confirmación.\n\n` +
      `Por favor revisá tu WhatsApp y confirmá asistencia. Si no confirmás a tiempo, el turno se cancela.`,
  ],

  // ── DEPOSIT_REMINDER ─────────────────────────────────────
    [MessageType.DEPOSIT_REMINDER]: [
    '⏳ Recordatorio: tu turno del {{fechaHumana}} a las {{horario}}hs está confirmado pero requiere seña.\n\n' +
      '💰 Alias: {{aliasPago}} - ${{montoSena}}\n\n' +
      'Si no abonás la seña a tiempo, el turno será cancelado automáticamente.',

    'Hola {{nombrePaciente}}! 👋\n' +
      'Tu turno del {{fechaHumana}} a las {{horario}}hs está reservado, pero falta la seña.\n\n' +
      '💰 ${{montoSena}} al alias: {{aliasPago}}\n\n' +
      'Si no la abonás antes del vencimiento, el turno se cancela.',

    '📌 {{nombrePaciente}}, recordatorio de seña pendiente.\n\n' +
      'Turno: {{fechaHumana}} a las {{horario}}hs\n' +
      '💰 Monto: ${{montoSena}}\n' +
      '💳 Alias: {{aliasPago}}\n\n' +
      'Aboná antes del vencimiento para no perder el turno.',
  ],

  // ── DEPOSIT_EXPIRED ──────────────────────────────────────
  [MessageType.DEPOSIT_EXPIRED]: [
    `⏹️ Tu turno del {{fechaHumana}} a las {{horario}}hs fue cancelado porque no se recibió la seña a tiempo.\n\n` +
      `Si querés reservar de nuevo, ingresá a nuestro sitio web.`,

    `Hola {{nombrePaciente}}! El turno del {{fechaHumana}} a las {{horario}}hs fue cancelado por falta de seña.\n\n` +
      `No te preocupes, podés volver a reservar desde nuestro sitio web cuando quieras.`,

    `⛔ {{nombrePaciente}}, se canceló tu turno del {{fechaHumana}} a las {{horario}}hs porque no se acreditó la seña.\n\n` +
      `Si querés reagendar, ingresá a nuestra web.`,
  ],
};

export interface ResolvedTemplate {
  messageType: TemplatableType;
  body: string;
  bodyV2?: string;
  bodyV3?: string;
  isEnabled: boolean;
  isDefault: boolean;
}

/**
 * Devuelve un array con todos los bodies no vacíos de una plantilla.
 * Orden: body (V0), bodyV2, bodyV3. Filtra nulos/vacíos.
 */
function collectBodies(
  variant0: string,
  variant2: string | null | undefined,
  variant3: string | null | undefined,
): string[] {
  const result = [variant0];
  if (variant2?.trim()) result.push(variant2.trim());
  if (variant3?.trim()) result.push(variant3.trim());
  return result;
}

/**
 * Elige un índice aleatorio del array.
 */
function randomIndex(arr: unknown[]): number {
  return Math.floor(Math.random() * arr.length);
}

@Injectable()
export class MessageTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    professionalId: string,
    organizationId?: string,
  ): Promise<ResolvedTemplate[]> {
    const where = organizationId ? { organizationId } : { professionalId };
    const saved = await this.prisma.messageTemplate.findMany({ where });

    const savedMap = new Map(saved.map((t) => [t.messageType, t]));

    return TEMPLATABLE_TYPES.map((type) => {
      const record = savedMap.get(type);
      const defaults = DEFAULT_TEMPLATE_VARIANTS[type];
      return {
        messageType: type,
        body: record?.body ?? defaults[0],
        bodyV2: record?.bodyV2 ?? defaults[1],
        bodyV3: record?.bodyV3 ?? defaults[2],
        isEnabled: record?.isEnabled ?? true,
        isDefault: !record,
      };
    });
  }

  async upsert(
    professionalId: string,
    messageType: TemplatableType,
    dto: UpsertTemplateDto,
    organizationId?: string,
  ): Promise<ResolvedTemplate> {
    const uniqueWhere = organizationId
      ? { organizationId_messageType: { organizationId, messageType } }
      : { professionalId_messageType: { professionalId, messageType } };

    const createData = organizationId
      ? {
          organizationId,
          messageType,
          body: dto.body,
          bodyV2: dto.bodyV2 ?? null,
          bodyV3: dto.bodyV3 ?? null,
          isEnabled: dto.isEnabled ?? true,
        }
      : {
          professionalId,
          messageType,
          body: dto.body,
          bodyV2: dto.bodyV2 ?? null,
          bodyV3: dto.bodyV3 ?? null,
          isEnabled: dto.isEnabled ?? true,
        };

    const updateData: Record<string, unknown> = {
      body: dto.body,
      isEnabled: dto.isEnabled ?? true,
    };
    if (dto.bodyV2 !== undefined) updateData.bodyV2 = dto.bodyV2;
    if (dto.bodyV3 !== undefined) updateData.bodyV3 = dto.bodyV3;

    const record = await this.prisma.messageTemplate.upsert({
      where: uniqueWhere,
      create: createData,
      update: updateData,
    });

    const defaults = DEFAULT_TEMPLATE_VARIANTS[messageType];
    return {
      messageType: record.messageType as TemplatableType,
      body: record.body,
      bodyV2: record.bodyV2 ?? defaults[1],
      bodyV3: record.bodyV3 ?? defaults[2],
      isEnabled: record.isEnabled,
      isDefault: false,
    };
  }

  async resetToDefault(
    professionalId: string,
    messageType: TemplatableType,
    organizationId?: string,
  ): Promise<ResolvedTemplate> {
    const where = organizationId
      ? { organizationId, messageType }
      : { professionalId, messageType };
    await this.prisma.messageTemplate.deleteMany({ where });

    const defaults = DEFAULT_TEMPLATE_VARIANTS[messageType];
    return {
      messageType,
      body: defaults[0],
      bodyV2: defaults[1],
      bodyV3: defaults[2],
      isEnabled: true,
      isDefault: true,
    };
  }

  async getOne(
    professionalId: string,
    messageType: TemplatableType,
    organizationId?: string,
  ): Promise<ResolvedTemplate> {
    const defaults = DEFAULT_TEMPLATE_VARIANTS[messageType];

    // For center professionals: check org-level template first
    if (organizationId) {
      const orgRecord = await this.prisma.messageTemplate.findUnique({
        where: { organizationId_messageType: { organizationId, messageType } },
      });
      const bodies = orgRecord
        ? collectBodies(orgRecord.body, orgRecord.bodyV2, orgRecord.bodyV3)
        : [...defaults];
      const idx = randomIndex(bodies);

      return {
        messageType,
        body: bodies[idx],
        bodyV2: orgRecord?.bodyV2 ?? defaults[1],
        bodyV3: orgRecord?.bodyV3 ?? defaults[2],
        isEnabled: orgRecord?.isEnabled ?? true,
        isDefault: !orgRecord,
      };
    }

    const record = await this.prisma.messageTemplate.findUnique({
      where: { professionalId_messageType: { professionalId, messageType } },
    });

    const bodies = record
      ? collectBodies(record.body, record.bodyV2, record.bodyV3)
      : [...defaults];
    const idx = randomIndex(bodies);

    return {
      messageType,
      body: bodies[idx],
      bodyV2: record?.bodyV2 ?? defaults[1],
      bodyV3: record?.bodyV3 ?? defaults[2],
      isEnabled: record?.isEnabled ?? true,
      isDefault: !record,
    };
  }
}
