/** Alineado con Prisma enum MessageType */
export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  APPOINTMENT_CREATED: "Alta de turno",
  APPOINTMENT_REMINDER: "Recordatorio",
  APPOINTMENT_RESCHEDULED: "Reprogramación",
  APPOINTMENT_CANCELLED: "Cancelación",
  PATIENT_REPLY: "Respuesta del paciente",
  SYSTEM: "Mensaje automático",
};

export function messageTypeLabel(type: string): string {
  return MESSAGE_TYPE_LABELS[type] ?? type;
}

export const MESSAGE_DIRECTION_LABELS: Record<string, string> = {
  OUTBOUND: "Enviado",
  INBOUND: "Recibido",
};
