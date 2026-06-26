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

export const DEFAULT_TEMPLATES: Record<TemplatableType, string> = {
  [MessageType.APPOINTMENT_CREATED]:
    `Hola {{nombrePaciente}}! 🗓️\n` +
    `Te confirmamos tu turno con {{nombreProfesional}}:\n` +
    `📅 {{diaSemana}}, {{fechaMes}} a las {{hora}}hs\n\n` +
    `¡Te esperamos!`,

  [MessageType.APPOINTMENT_REMINDER]:
    `📋 Recordatorio de turno\n` +
    `Hola {{nombrePaciente}}! {{diaRelativo}} tenés turno con {{nombreProfesional}} a las {{hora}}hs.\n\n` +
    `Confirmá tu asistencia:\n` +
    `1️⃣ Confirmo que voy\n` +
    `2️⃣ No puedo asistir`,

  [MessageType.APPOINTMENT_RESCHEDULED]:
    `🔄 Tu turno fue reprogramado.\n` +
    `Nueva fecha: *{{diaSemana}}, {{fechaMes}} a las {{hora}}hs* con {{nombreProfesional}}.\n\n` +
    `📍 ¡Te esperamos!`,

  [MessageType.APPOINTMENT_CANCELLED]:
    `Hola {{nombrePaciente}}, tu turno del *{{diaSemana}} {{fechaMes}} a las {{hora}}hs* con {{nombreProfesional}} fue cancelado.\n\n` +
    `Contactate con nosotros para reprogramar. ¡Hasta pronto! 👋`,

  [MessageType.PAYMENT_REMINDER]:
    'Hola {{nombrePaciente}}! 🤗\n\n' +
    'Muchas gracias por venir a tu sesión del *{{diaSemana}} {{fechaMes}} a las {{hora}}hs*. ' +
    'Fue un gusto atenderte 💫\n\n' +
    'Te recordamos que tenés pendiente el pago de *${{monto}}* correspondiente a esa sesión.\n' +
    '💳 Alias: *{{aliasPago}}*\n\n' +
    '_Si ya realizaste la transferencia, por favor ignorá este mensaje. 🙏_\n\n' +
    '❤️ Hasta la próxima, {{nombreProfesional}}',

  [MessageType.BOOKING_CONFIRMED]:
    `¡Hola {{nombrePaciente}}! 👋\n\n` +
    `✅ Tu turno quedó reservado:\n` +
    `📅 {{fechaHumana}} a las {{horario}}hs\n` +
    `👤 Con {{nombreProfesional}}\n\n` +
    `{{detalleSena}}` +
    `{{detalleFicha}}` +
    `Tu código de reserva es: {{codigoReserva}}\n\n` +
    `¡Te esperamos!`,

  [MessageType.BOOKING_UNCONFIRMED_WARNING]:
    `⏰ Recordatorio: tenés un turno pendiente de confirmación para el {{fechaHumana}} a las {{horario}}hs.\n\n` +
    'Por favor confirmá tu reserva respondiendo el mensaje de WhatsApp que te enviamos.\n' +
    `Si no confirmás, el turno será cancelado automáticamente.\n\n` +
    `¡Gracias!`,

  [MessageType.DEPOSIT_REMINDER]:
    `⏳ Recordatorio: tu turno del {{fechaHumana}} a las {{horario}}hs está confirmado pero requiere seña.\n\n` +
    '💰 Alias: {{aliasPago}} - ${{montoSena}}\n\n' +
    `Si no abonás la seña a tiempo, el turno será cancelado automáticamente.`,

  [MessageType.DEPOSIT_EXPIRED]:
    `⏹️ Tu turno del {{fechaHumana}} a las {{horario}}hs fue cancelado porque no se recibió la seña a tiempo.\n\n` +
    `Si querés reservar de nuevo, ingresá a nuestro sitio web.`,
};

export interface ResolvedTemplate {
  messageType: TemplatableType;
  body: string;
  isEnabled: boolean;
  isDefault: boolean;
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
      return {
        messageType: type,
        body: record?.body ?? DEFAULT_TEMPLATES[type],
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
          isEnabled: dto.isEnabled ?? true,
        }
      : {
          professionalId,
          messageType,
          body: dto.body,
          isEnabled: dto.isEnabled ?? true,
        };

    const record = await this.prisma.messageTemplate.upsert({
      where: uniqueWhere,
      create: createData,
      update: { body: dto.body, isEnabled: dto.isEnabled ?? true },
    });

    return {
      messageType: record.messageType as TemplatableType,
      body: record.body,
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

    return {
      messageType,
      body: DEFAULT_TEMPLATES[messageType],
      isEnabled: true,
      isDefault: true,
    };
  }

  async getOne(
    professionalId: string,
    messageType: TemplatableType,
    organizationId?: string,
  ): Promise<ResolvedTemplate> {
    // For center professionals: check org-level template first, then fall back to default
    if (organizationId) {
      const orgRecord = await this.prisma.messageTemplate.findUnique({
        where: { organizationId_messageType: { organizationId, messageType } },
      });
      return {
        messageType,
        body: orgRecord?.body ?? DEFAULT_TEMPLATES[messageType],
        isEnabled: orgRecord?.isEnabled ?? true,
        isDefault: !orgRecord,
      };
    }

    const record = await this.prisma.messageTemplate.findUnique({
      where: { professionalId_messageType: { professionalId, messageType } },
    });

    return {
      messageType,
      body: record?.body ?? DEFAULT_TEMPLATES[messageType],
      isEnabled: record?.isEnabled ?? true,
      isDefault: !record,
    };
  }
}
