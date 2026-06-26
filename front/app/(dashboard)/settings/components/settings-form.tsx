"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { sileo } from "sileo";
import { ProfessionalSettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: ProfessionalSettings }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [digestEnabled, setDigestEnabled] = useState(
    settings.dailyDigestEnabled,
  );
  const [autoConfirmEnabled, setAutoConfirmEnabled] = useState(
    settings.autoConfirmHours !== null,
  );
  const [bookingEnabled, setBookingEnabled] = useState(
    settings.publicBookingEnabled,
  );
  const [autoCancelEnabled, setAutoCancelEnabled] = useState(
    settings.bookingAutoCancel,
  );

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const rawAlias = (formData.get("paymentAlias") as string)?.trim();
    const payload: Record<string, unknown> = {
      consultationMinutes: Number(formData.get("consultationMinutes")),
      bufferMinutes: Number(formData.get("bufferMinutes")),
      minRescheduleHours: Number(formData.get("minRescheduleHours")),
      standardFee: Number(formData.get("standardFee")),
      reminderHours: Number(formData.get("reminderHours")),
      timezone: formData.get("timezone"),
      dailyDigestEnabled: digestEnabled,
      dailyDigestTime: formData.get("dailyDigestTime") || "08:00",
      autoConfirmHours: autoConfirmEnabled
        ? Number(formData.get("autoConfirmHours"))
        : null,
      paymentAlias: rawAlias || null,
      // Public booking
      publicBookingEnabled: bookingEnabled,
      publicBookingSlug: formData.get("publicBookingSlug") || null,
      depositAmount: formData.get("depositAmount")
        ? Number(formData.get("depositAmount"))
        : null,
      depositWindowHours: Number(formData.get("depositWindowHours")),
      bookingAutoCancel: autoCancelEnabled,
      bookingAutoCancelHours: Number(formData.get("bookingAutoCancelHours")),
      maxActiveBookings: Number(formData.get("maxActiveBookings")),
      waPublicBookingPhone: formData.get("waPublicBookingPhone") || null,
    };

    const response = await fetch("/api/backend/professional/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!response.ok) {
      sileo.error({ title: "No se pudo guardar configuración" });
      return;
    }

    sileo.success({ title: "Configuración actualizada" });
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-6">
      {/* Parámetros generales */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Parámetros del profesional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Duración consulta (min)"
              name="consultationMinutes"
              type="number"
              defaultValue={settings.consultationMinutes}
              hint="15, 20, 30, 45 o 60 minutos"
            />
            <Field
              label="Buffer entre consultas (min)"
              name="bufferMinutes"
              type="number"
              defaultValue={settings.bufferMinutes}
              hint="0, 5, 10 o 15 minutos"
            />
            <Field
              label="Mín. reprogramación (h)"
              name="minRescheduleHours"
              type="number"
              defaultValue={settings.minRescheduleHours}
              hint="Anticipación mínima del paciente"
            />
            <Field
              label="Honorario estándar"
              name="standardFee"
              type="number"
              defaultValue={Number(settings.standardFee)}
              hint="Editable por turno individual"
            />
            <Field
              label="Recordatorio paciente (h antes)"
              name="reminderHours"
              type="number"
              defaultValue={settings.reminderHours}
              hint="12, 24 o 48 horas"
            />
            <Field
              label="Zona horaria"
              name="timezone"
              defaultValue={settings.timezone}
              hint="Ej: America/Argentina/Buenos_Aires"
            />
          </div>
        </CardContent>
      </Card>

      {/* Digest diario */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Resumen diario por WhatsApp
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Recibí un mensaje con tus turnos del día a la hora que elijas
              </p>
            </div>
            <Switch
              checked={digestEnabled}
              onCheckedChange={setDigestEnabled}
            />
          </div>
        </CardHeader>
        {digestEnabled && (
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Hora de envío"
                name="dailyDigestTime"
                type="time"
                defaultValue={settings.dailyDigestTime}
                hint="Se envía a tu número de WhatsApp personal"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Auto-confirmación */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Auto-confirmación de turnos
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirma automáticamente los turnos pendientes que ya recibieron
                recordatorio
              </p>
            </div>
            <Switch
              checked={autoConfirmEnabled}
              onCheckedChange={setAutoConfirmEnabled}
            />
          </div>
        </CardHeader>
        {autoConfirmEnabled && (
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Confirmar si faltan menos de (horas)"
                name="autoConfirmHours"
                type="number"
                defaultValue={settings.autoConfirmHours ?? 2}
                hint="Ej: 2 = si en 2h el paciente no respondió, se confirma solo"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reservas online */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Reservas online
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Los pacientes reservan turno por la web, sin llamar
              </p>
            </div>
            <Switch
              checked={bookingEnabled}
              onCheckedChange={setBookingEnabled}
            />
          </div>
        </CardHeader>
        {bookingEnabled && (
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Slug público"
                name="publicBookingSlug"
                defaultValue={settings.publicBookingSlug ?? ""}
                hint="Ej: /reservar/demo — solo minúsculas y guiones"
              />
              <Field
                label="Seña ($)"
                name="depositAmount"
                type="number"
                defaultValue={settings.depositAmount ? Number(settings.depositAmount) : ""}
                hint="Dejá vacío si no requerís seña"
              />
              <Field
                label="Ventana de seña (hs)"
                name="depositWindowHours"
                type="number"
                defaultValue={settings.depositWindowHours}
                hint="Tiempo para pagar antes de cancelar"
              />
              <Field
                label="Máx. activas por persona"
                name="maxActiveBookings"
                type="number"
                defaultValue={settings.maxActiveBookings}
                hint="0 = sin límite"
              />
              <Field
                label="WhatsApp para booking"
                name="waPublicBookingPhone"
                defaultValue={settings.waPublicBookingPhone ?? ""}
                hint="Nro donde recibís las solicitudes. Si no, se usa tu teléfono personal"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Auto-cancelar por seña</p>
                <p className="text-xs text-muted-foreground">
                  Cancelar automáticamente si no paga la seña a tiempo
                </p>
              </div>
              <Switch
                checked={autoCancelEnabled}
                onCheckedChange={setAutoCancelEnabled}
              />
            </div>
            <div className="mt-4 rounded-lg bg-muted/50 px-3 py-2">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Cancelar no confirmados</p>
                  <p className="text-xs text-muted-foreground">
                    Si el paciente nunca confirmó la reserva, cancelar automáticamente N horas antes del turno
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Field
                  label="Cancelar si no confirmó (hs antes)"
                  name="bookingAutoCancelHours"
                  type="number"
                  defaultValue={settings.bookingAutoCancelHours}
                  hint="Ej: 8 = cancela 8hs antes del turno"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recordatorio de pago */}
      <Card className="shadow-card">
        <CardHeader>
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Recordatorio de pago por WhatsApp
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              24hs después de la sesión se envía un mensaje cálido al paciente si pagó por transferencia
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Alias de pago"
              name="paymentAlias"
              defaultValue={settings.paymentAlias ?? ""}
              hint="Se incluye en el recordatorio (ej: tu.alias.mp)"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={loading} type="submit" size="lg">
          {loading ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string | number;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
