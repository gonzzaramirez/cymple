import { MessageTemplateType } from "./types";

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
  description: string;
}

export interface TemplateMeta {
  type: MessageTemplateType;
  label: string;
  description: string;
  icon: string;
  variables: TemplateVariable[];
  sampleData: Record<string, string>;
}

const COMMON_VARIABLES: TemplateVariable[] = [
  {
    key: "nombrePaciente",
    label: "Nombre del paciente",
    example: "María",
    description: "Primer nombre del paciente",
  },
  {
    key: "nombreProfesional",
    label: "Nombre del profesional",
    example: "Dr. García",
    description: "Nombre completo del profesional",
  },
  {
    key: "diaSemana",
    label: "Día de la semana",
    example: "Martes",
    description: "Día de la semana del turno",
  },
  {
    key: "fechaMes",
    label: "Fecha (día y mes)",
    example: "15 de abril",
    description: "Día y mes del turno",
  },
  {
    key: "hora",
    label: "Hora",
    example: "14:30",
    description: "Hora del turno en formato HH:MM",
  },
];

const COMMON_SAMPLE: Record<string, string> = {
  nombrePaciente: "María",
  nombreProfesional: "Dr. García",
  diaSemana: "Martes",
  fechaMes: "15 de abril",
  hora: "14:30",
};

export const TEMPLATE_META: TemplateMeta[] = [
  {
    type: "APPOINTMENT_CREATED",
    label: "Turno creado",
    description: "Se envía al paciente cuando se agenda un nuevo turno",
    icon: "📅",
    variables: COMMON_VARIABLES,
    sampleData: COMMON_SAMPLE,
  },
  {
    type: "APPOINTMENT_REMINDER",
    label: "Recordatorio de turno",
    description:
      "Se envía antes del turno para que el paciente confirme asistencia",
    icon: "🔔",
    variables: [
      ...COMMON_VARIABLES,
      {
        key: "diaRelativo",
        label: "Día relativo",
        example: "Mañana",
        description: '"Hoy", "Mañana" o la fecha completa',
      },
    ],
    sampleData: { ...COMMON_SAMPLE, diaRelativo: "Mañana" },
  },
  {
    type: "APPOINTMENT_RESCHEDULED",
    label: "Turno reprogramado",
    description: "Se envía al paciente cuando su turno es reprogramado",
    icon: "🔄",
    variables: COMMON_VARIABLES,
    sampleData: COMMON_SAMPLE,
  },
  {
    type: "APPOINTMENT_CANCELLED",
    label: "Turno cancelado",
    description:
      "Se envía al paciente cuando el profesional cancela el turno",
    icon: "❌",
    variables: COMMON_VARIABLES,
    sampleData: COMMON_SAMPLE,
  },
  {
    type: "PAYMENT_REMINDER",
    label: "Recordatorio de pago",
    description:
      "Se envía 24hs después de la sesión cuando el pago es por transferencia",
    icon: "💳",
    variables: [
      ...COMMON_VARIABLES,
      {
        key: "monto",
        label: "Monto",
        example: "5.000",
        description: "Monto de la sesión formateado",
      },
      {
        key: "aliasPago",
        label: "Alias de pago",
        example: "mi.alias.pago",
        description: "Alias de transferencia configurado",
      },
    ],
    sampleData: {
      ...COMMON_SAMPLE,
      monto: "5.000",
      aliasPago: "mi.alias.pago",
    },
  },
  {
    type: "BOOKING_CONFIRMED",
    label: "Reserva confirmada",
    description:
      "Se envía al paciente cuando confirma la reserva online (con o sin seña)",
    icon: "✅",
    variables: [
      ...COMMON_VARIABLES,
      {
        key: "fechaHumana",
        label: "Fecha completa",
        example: "domingo, 28 de junio de 2026",
        description: "Fecha con día de semana y mes",
      },
      {
        key: "horario",
        label: "Horario",
        example: "09:00",
        description: "Hora del turno en formato HH:MM",
      },
      {
        key: "detalleSena",
        label: "Detalle de seña",
        example: "💰 Seña: $5.000 — Alias: mi.alias\n⏳ Tenés 24hs para enviar el comprobante.\n",
        description: "Información de seña (vacío si no requiere seña)",
      },
      {
        key: "detalleFicha",
        label: "Link de ficha de ingreso",
        example: "📋 Completá tu ficha de ingreso:\nhttps://…/ficha/abc\n\n",
        description: "Link a ficha de ingreso (vacío si ya la completó)",
      },
      {
        key: "codigoReserva",
        label: "Código de reserva",
        example: "R-005",
        description: "Código único de la reserva",
      },
    ],
    sampleData: {
      ...COMMON_SAMPLE,
      fechaHumana: "domingo, 28 de junio de 2026",
      horario: "09:00",
      detalleSena:
        "💰 Seña: $5.000 — Alias: mi.alias.pago\n⏳ Tenés 24hs para enviar el comprobante.\n",
      detalleFicha:
        "📋 Completá tu ficha de ingreso (solo una vez):\nhttps://miapp.com/ficha/abc123\n\n",
      codigoReserva: "R-005",
    },
  },
  {
    type: "BOOKING_UNCONFIRMED_WARNING",
    label: "Aviso de reserva pendiente",
    description:
      "Se envía al paciente cuando no confirmó la reserva y se acerca el turno",
    icon: "⏰",
    variables: [
      {
        key: "fechaHumana",
        label: "Fecha completa",
        example: "domingo, 28 de junio de 2026",
        description: "Fecha con día de semana y mes",
      },
      {
        key: "horario",
        label: "Horario",
        example: "09:00",
        description: "Hora del turno en formato HH:MM",
      },
    ],
    sampleData: {
      fechaHumana: "domingo, 28 de junio de 2026",
      horario: "09:00",
    },
  },
  {
    type: "DEPOSIT_REMINDER",
    label: "Recordatorio de seña",
    description: "Se envía cuando falta poco para que venza la seña pendiente",
    icon: "⏳",
    variables: [
      {
        key: "fechaHumana",
        label: "Fecha completa",
        example: "domingo, 28 de junio de 2026",
        description: "Fecha con día de semana y mes",
      },
      {
        key: "horario",
        label: "Horario",
        example: "09:00",
        description: "Hora del turno en formato HH:MM",
      },
      {
        key: "aliasPago",
        label: "Alias de pago",
        example: "mi.alias.pago",
        description: "Alias de transferencia configurado",
      },
      {
        key: "montoSena",
        label: "Monto de seña",
        example: "5.000",
        description: "Monto de la seña formateado",
      },
    ],
    sampleData: {
      fechaHumana: "domingo, 28 de junio de 2026",
      horario: "09:00",
      aliasPago: "mi.alias.pago",
      montoSena: "5.000",
    },
  },
  {
    type: "DEPOSIT_EXPIRED",
    label: "Seña vencida",
    description: "Se envía al paciente cuando la seña no se pagó a tiempo",
    icon: "⏹️",
    variables: [
      {
        key: "fechaHumana",
        label: "Fecha completa",
        example: "domingo, 28 de junio de 2026",
        description: "Fecha con día de semana y mes",
      },
      {
        key: "horario",
        label: "Horario",
        example: "09:00",
        description: "Hora del turno en formato HH:MM",
      },
    ],
    sampleData: {
      fechaHumana: "domingo, 28 de junio de 2026",
      horario: "09:00",
    },
  },
];

export function getTemplateMeta(type: MessageTemplateType): TemplateMeta {
  return TEMPLATE_META.find((m) => m.type === type)!;
}

export function interpolateTemplate(
  body: string,
  data: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return data[key] !== undefined ? data[key] : `{{${key}}}`;
  });
}

export const DEFAULT_TEMPLATE_BODIES: Record<MessageTemplateType, string> = {
  APPOINTMENT_CREATED:
    "Hola {{nombrePaciente}}! 🗓️\n" +
    "Te confirmamos tu turno con {{nombreProfesional}}:\n" +
    "📅 {{diaSemana}}, {{fechaMes}} a las {{hora}}hs\n\n" +
    "¡Te esperamos!",

  APPOINTMENT_REMINDER:
    "📋 Recordatorio de turno\n" +
    "Hola {{nombrePaciente}}! {{diaRelativo}} tenés turno con {{nombreProfesional}} a las {{hora}}hs.\n\n" +
    "Confirmá tu asistencia:\n" +
    "1️⃣ Confirmo que voy\n" +
    "2️⃣ No puedo asistir",

  APPOINTMENT_RESCHEDULED:
    "🔄 Tu turno fue reprogramado.\n" +
    "Nueva fecha: *{{diaSemana}}, {{fechaMes}} a las {{hora}}hs* con {{nombreProfesional}}.\n\n" +
    "📍 ¡Te esperamos!",

  APPOINTMENT_CANCELLED:
    "Hola {{nombrePaciente}}, tu turno del *{{diaSemana}} {{fechaMes}} a las {{hora}}hs* con {{nombreProfesional}} fue cancelado.\n\n" +
    "Contactate con nosotros para reprogramar. ¡Hasta pronto! 👋",

  PAYMENT_REMINDER:
    "Hola {{nombrePaciente}}! 🤗\n\n" +
    "Muchas gracias por venir a tu sesión del *{{diaSemana}} {{fechaMes}} a las {{hora}}hs*. " +
    "Fue un gusto atenderte 💫\n\n" +
    "Te recordamos que tenés pendiente el pago de *${{monto}}* correspondiente a esa sesión.\n" +
    "💳 Alias: *{{aliasPago}}*\n\n" +
    "_Si ya realizaste la transferencia, por favor ignorá este mensaje. 🙏_\n\n" +
    "❤️ Hasta la próxima, {{nombreProfesional}}",

  BOOKING_UNCONFIRMED_WARNING:
    "⏰ Recordatorio: tenés un turno pendiente de confirmación para el {{fechaHumana}} a las {{horario}}hs.\n\n" +
    "Por favor confirmá tu reserva respondiendo el mensaje de WhatsApp que te enviamos.\n" +
    "Si no confirmás, el turno será cancelado automáticamente.\n\n" +
    "¡Gracias!",

  BOOKING_CONFIRMED:
    "¡Hola {{nombrePaciente}}! 👋\n\n" +
    "✅ Tu turno quedó reservado:\n" +
    "📅 {{fechaHumana}} a las {{horario}}hs\n" +
    "👤 Con {{nombreProfesional}}\n\n" +
    "{{detalleSena}}" +
    "{{detalleFicha}}" +
    "Tu código de reserva es: {{codigoReserva}}\n\n" +
    "¡Te esperamos!",

  DEPOSIT_REMINDER:
    "⏳ Recordatorio: tu turno del {{fechaHumana}} a las {{horario}}hs está confirmado pero requiere seña.\n\n" +
    "💰 Alias: {{aliasPago}} - ${{montoSena}}\n\n" +
    "Si no abonás la seña a tiempo, el turno será cancelado automáticamente.",

  DEPOSIT_EXPIRED:
    "⏹️ Tu turno del {{fechaHumana}} a las {{horario}}hs fue cancelado porque no se recibió la seña a tiempo.\n\n" +
    "Si querés reservar de nuevo, ingresá a nuestro sitio web.",
};
