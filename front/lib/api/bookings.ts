const BASE = "/api/backend/bookings";

/**
 * Booking lifecycle statuses (matches Prisma `BookingStatus` enum).
 * - PENDING_WA_CONFIRMATION: user created booking, hasn't sent WA yet
 * - WA_CONTACTED: WA received, slot reserved, awaiting deposit
 * - BOOKED: deposit window active (alias `DEPOSIT_PENDING` for user-facing copy)
 * - INTAKE_SENT / INTAKE_COMPLETED: clinical intake form flow
 * - EXPIRED / CANCELLED: terminal states
 */
export type BookingStatus =
  | "PENDING_WA_CONFIRMATION"
  | "WA_CONTACTED"
  | "BOOKED"
  | "INTAKE_SENT"
  | "INTAKE_COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type BookingSummary = {
  id: string;
  token: string;
  patientName: string;
  patientPhone: string;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
  status: BookingStatus;
  depositAmount?: number | null;
  depositPaidAt?: string | null;
  depositWindowHours?: number | null;
  professionalSlug: string;
  createdAt: string;
};

export type BookingDetail = {
  id: string;
  token: string;
  patientName: string;
  patientPhone: string;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
  status: BookingStatus;
  depositStatus?: string;
  depositAmount?: string | number | null;
  depositPaidAt?: string | null;
  depositWindowHours?: number | null;
  expiresAt?: string | null;
  waContactedAt?: string | null;
  intakeCompleted?: boolean;
  notes?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  professionalSlug: string;
  professionalId: string;
  professionalName: string;
  createdAt: string;
  updatedAt?: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  appointment?: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
  } | null;
};

export type BookingFilters = {
  status?: BookingStatus | "ALL";
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
};

export type PaginatedBookings = {
  items: BookingSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function buildQuery(filters: BookingFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.month !== undefined) {
    params.set("month", String(filters.month + 1));
    params.set("year", String(filters.year ?? new Date().getFullYear()));
  }
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return params.toString();
}

export async function listBookings(
  filters: BookingFilters,
): Promise<PaginatedBookings> {
  const qs = buildQuery(filters);
  const res = await fetch(`${BASE}?${qs}`);
  if (!res.ok) throw new Error("Error al obtener reservas");
  return res.json();
}

export async function getBookingDetail(
  id: string,
): Promise<BookingDetail> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    throw new Error("Error al obtener detalle de la reserva");
  }
  return res.json();
}

export async function markDepositPaid(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/deposit`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al marcar depósito como pagado");
}

export async function cancelBooking(
  id: string,
  reason?: string,
): Promise<void> {
  const res = await fetch(`${BASE}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "CANCELLED", cancelReason: reason ?? null }),
  });
  if (!res.ok) throw new Error("Error al cancelar la reserva");
}

export async function manualConfirmBooking(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/confirm`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al confirmar la reserva manualmente");
}

export async function updateBookingNotes(
  id: string,
  notes: string,
): Promise<void> {
  const res = await fetch(`${BASE}/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Error al actualizar notas");
}

export const STATUS_OPTIONS: {
  value: BookingStatus | "ALL";
  label: string;
  variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info";
}[] = [
  { value: "ALL", label: "Todas", variant: "default" },
  {
    value: "PENDING_WA_CONFIRMATION",
    label: "Esperando WA",
    variant: "warning",
  },
  { value: "WA_CONTACTED", label: "Contactado", variant: "info" },
  { value: "BOOKED", label: "Seña pendiente", variant: "warning" },
  { value: "INTAKE_SENT", label: "Ficha enviada", variant: "info" },
  { value: "INTAKE_COMPLETED", label: "Ficha completa", variant: "success" },
  { value: "CANCELLED", label: "Cancelado", variant: "destructive" },
  { value: "EXPIRED", label: "Expirado", variant: "secondary" },
];

export const STATUS_BADGE_MAP: Record<
  BookingStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" }
> = {
  PENDING_WA_CONFIRMATION: { label: "Esperando WA", variant: "warning" },
  WA_CONTACTED: { label: "Contactado", variant: "info" },
  BOOKED: { label: "Seña pendiente", variant: "warning" },
  INTAKE_SENT: { label: "Ficha enviada", variant: "info" },
  INTAKE_COMPLETED: { label: "Ficha completa", variant: "success" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  EXPIRED: { label: "Expirado", variant: "secondary" },
};
