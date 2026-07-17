const BASE = "/api/backend/organization/public-booking-settings";

export type OrgPublicBookingSettings = {
  publicBookingEnabled: boolean;
  publicBookingSlug: string | null;
  depositAmount: number | null;
  depositWindowHours: number;
  bookingAutoCancel: boolean;
  bookingAutoCancelHours: number;
  maxActiveBookings: number;
  waPublicBookingPhone: string | null;
  intakeEnabled: boolean;
  depositEnabled: boolean;
};

export async function getOrgPublicBookingSettings(): Promise<OrgPublicBookingSettings> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("Error al obtener configuración de reservas");
  return res.json();
}

export async function updateOrgPublicBookingSettings(
  payload: Partial<OrgPublicBookingSettings>,
): Promise<OrgPublicBookingSettings> {
  const res = await fetch(BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error al guardar configuración de reservas");
  return res.json();
}
