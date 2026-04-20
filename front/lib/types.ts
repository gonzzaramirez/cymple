export type ApiList<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  dni?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  bufferMinutes: number;
  status: "PENDING" | "CONFIRMED" | "ATTENDED" | "ABSENT" | "CANCELLED";
  fee: string;
  reason?: string | null;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export type FinanceSummary = {
  month: string;
  totals: {
    income: number;
    expense: number;
    net: number;
    attendedCount: number;
    absentCount: number;
    occupancyPercent: number;
  };
};

export type ProfessionalSettings = {
  id: string;
  fullName: string;
  consultationMinutes: number;
  bufferMinutes: number;
  minRescheduleHours: number;
  standardFee: string;
  reminderHours: number;
  timezone: string;
};

export type MessageLogEntry = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  messageType: string;
  content: string;
  toPhone?: string | null;
  fromPhone?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  appointmentId?: string | null;
};

export type MessageLogWithPatient = MessageLogEntry & {
  patientId: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type MessageGroupedByPatient = {
  patientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalMessages: number;
  typeCounts: Partial<Record<string, number>>;
  lastMessageAt: string | null;
};
