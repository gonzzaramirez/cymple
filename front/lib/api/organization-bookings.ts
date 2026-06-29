const BASE = "/api/backend/organization/bookings";

import type {
  BookingFilters,
  PaginatedBookings,
  BookingDetail,
} from "@/lib/api/bookings";

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

export async function listOrgBookings(
  filters: BookingFilters,
): Promise<PaginatedBookings> {
  const qs = buildQuery(filters);
  const res = await fetch(`${BASE}?${qs}`);
  if (!res.ok) throw new Error("Error al obtener reservas del centro");
  return res.json();
}

export async function getOrgBookingDetail(id: string): Promise<BookingDetail> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    throw new Error("Error al obtener detalle de la reserva");
  }
  return res.json();
}

export async function markOrgDepositPaid(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/deposit`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al marcar depósito como pagado");
}

export async function cancelOrgBooking(
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

export async function manualConfirmOrgBooking(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/confirm`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al confirmar la reserva manualmente");
}

export async function updateOrgBookingNotes(
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
