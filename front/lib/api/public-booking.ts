const BASE = "/api/backend/public";

export type ProfessionalPublic = {
  id: string;
  fullName: string;
  specialty?: string | null;
  photoUrl?: string | null;
  depositAmount?: string | number | null;
  depositWindowHours?: number | null;
  consultationMinutes?: number;
  standardFee?: string | number | null;
  paymentAlias?: string | null;
  depositEnabled: boolean;
};

export type SlotInfo = {
  startAt: string;
  endAt: string;
  bookedCount: number;
  remainingCapacity: number | null;
  hasCapacityLimit: boolean;
};

export type SlotsResponse = {
  date: string;
  slots: SlotInfo[];
};

export type CreateBookingDto = {
  professionalSlug: string;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
  patientName: string;
  patientPhone: string;
};

export type BookingCreatedResponse = {
  token: string;
  waDeepLink: string;
  expiresAt: string;
};

export type BookingStatusResponse = {
  status: string;
  depositStatus: string;
  depositAmount: string | null;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
};

export type IntakeStatusResponse = {
  hasCompletedIntake: boolean;
  patientId?: string;
};

export type OrganizationProfessional = {
  id: string;
  fullName: string;
  specialty?: string | null;
  depositAmount?: string | number | null;
  depositWindowHours?: number | null;
  consultationMinutes?: number;
  standardFee?: string | number | null;
  paymentAlias?: string | null;
  publicBookingSlug?: string | null;
};

export async function getOrganizationProfessionals(
  orgSlug: string,
): Promise<OrganizationProfessional[]> {
  const res = await fetch(`${BASE}/organizations/${orgSlug}/professionals`);
  if (!res.ok) {
    throw new Error("Error al obtener profesionales del centro");
  }
  return res.json();
}

export async function getProfessional(
  slug: string,
): Promise<ProfessionalPublic> {
  const res = await fetch(`${BASE}/professionals/${slug}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    throw new Error("Error al obtener información del profesional");
  }
  return res.json();
}

export async function getAvailability(
  slug: string,
  from: string,
  to: string,
): Promise<{ dates: string[]; from: string; to: string }> {
  const res = await fetch(
    `${BASE}/professionals/${slug}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!res.ok) {
    throw new Error("Error al obtener disponibilidad");
  }
  return res.json();
}

export async function getSlots(
  slug: string,
  date: string,
): Promise<SlotsResponse> {
  const res = await fetch(
    `${BASE}/professionals/${slug}/slots?date=${encodeURIComponent(date)}`,
  );
  if (!res.ok) {
    throw new Error("Error al obtener horarios disponibles");
  }
  return res.json();
}

export async function createBooking(
  dto: CreateBookingDto,
): Promise<BookingCreatedResponse> {
  const res = await fetch(`${BASE}/booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 409) throw new Error("SLOT_TAKEN");
    if (res.status === 400) throw new Error(text || "Datos inválidos");
    throw new Error(text || "Error al crear la reserva");
  }
  return res.json();
}

export async function getBookingStatus(
  token: string,
): Promise<BookingStatusResponse> {
  const res = await fetch(`${BASE}/booking/${token}/status`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    throw new Error("Error al obtener estado de la reserva");
  }
  return res.json();
}

export async function checkIntakeStatus(
  slug: string,
  phone: string,
): Promise<IntakeStatusResponse> {
  const res = await fetch(
    `${BASE}/professionals/${slug}/intake-status?phone=${encodeURIComponent(phone)}`,
  );
  if (!res.ok) {
    // If 404 or error, assume no intake data
    return { hasCompletedIntake: false };
  }
  return res.json();
}
