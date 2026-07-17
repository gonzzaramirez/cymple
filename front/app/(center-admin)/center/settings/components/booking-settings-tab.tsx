"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { sileo } from "sileo";
import {
  getOrgPublicBookingSettings,
  updateOrgPublicBookingSettings,
  type OrgPublicBookingSettings,
} from "@/lib/api/organization-settings";

export function BookingSettingsTab() {
  const [settings, setSettings] = useState<OrgPublicBookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [autoCancelEnabled, setAutoCancelEnabled] = useState(true);
  const [intakeEnabled, setIntakeEnabled] = useState(true);
  const [depositEnabled, setDepositEnabled] = useState(true);

  useEffect(() => {
    getOrgPublicBookingSettings()
      .then((data) => {
        setSettings(data);
        setBookingEnabled(data.publicBookingEnabled);
        setAutoCancelEnabled(data.bookingAutoCancel);
        setIntakeEnabled(data.intakeEnabled);
        setDepositEnabled(data.depositEnabled);
      })
      .catch(() => {
        sileo.error({ title: "No se pudo cargar la configuración" });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    const formData = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      publicBookingEnabled: bookingEnabled,
      publicBookingSlug: formData.get("publicBookingSlug") || null,
      waPublicBookingPhone: formData.get("waPublicBookingPhone") || null,
    };

    // Only include booking config fields when the section is visible
    if (bookingEnabled) {
      payload.depositAmount = formData.get("depositAmount")
        ? Number(formData.get("depositAmount"))
        : null;
      payload.depositWindowHours = Number(formData.get("depositWindowHours"));
      payload.bookingAutoCancel = autoCancelEnabled;
      payload.bookingAutoCancelHours = Number(formData.get("bookingAutoCancelHours"));
      payload.maxActiveBookings = Number(formData.get("maxActiveBookings"));
    }

    payload.intakeEnabled = intakeEnabled;
    payload.depositEnabled = depositEnabled;

    try {
      const result = await updateOrgPublicBookingSettings(payload);
      setSettings(result);
      setBookingEnabled(result.publicBookingEnabled);
      setAutoCancelEnabled(result.bookingAutoCancel);
      setIntakeEnabled(result.intakeEnabled);
      setDepositEnabled(result.depositEnabled);
      sileo.success({ title: "Configuración de reservas actualizada" });
    } catch {
      sileo.error({ title: "No se pudo guardar la configuración" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Toggle */}
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
            {/* Toggles */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Ficha de ingreso</p>
                  <p className="text-xs text-muted-foreground">
                    {intakeEnabled
                      ? "El paciente recibe un link para completar su ficha"
                      : "No se enviará link de ficha de ingreso"}
                  </p>
                </div>
                <Switch
                  checked={intakeEnabled}
                  onCheckedChange={setIntakeEnabled}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Seña</p>
                  <p className="text-xs text-muted-foreground">
                    {depositEnabled
                      ? "El paciente debe pagar una seña para confirmar el turno"
                      : "Los turnos se confirman automáticamente sin requerir seña"}
                  </p>
                </div>
                <Switch
                  checked={depositEnabled}
                  onCheckedChange={setDepositEnabled}
                />
              </div>
            </div>

            {depositEnabled && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Slug público"
                    name="publicBookingSlug"
                    defaultValue={settings?.publicBookingSlug ?? ""}
                    hint="Ej: mi-centro — solo minúsculas y guiones. Si se deja vacío, se usa el slug del centro"
                  />
                  <Field
                    label="WhatsApp para booking"
                    name="waPublicBookingPhone"
                    defaultValue={settings?.waPublicBookingPhone ?? ""}
                    hint="Nro donde los pacientes envían la confirmación. Si no, se usa el del profesional"
                  />
                  <Field
                    label="Seña ($)"
                    name="depositAmount"
                    type="number"
                    defaultValue={settings?.depositAmount ? Number(settings.depositAmount) : ""}
                    hint="Valor por defecto para todos los profesionales. Dejá vacío si no requerís seña"
                  />
                  <Field
                    label="Ventana de seña (hs)"
                    name="depositWindowHours"
                    type="number"
                    defaultValue={settings?.depositWindowHours ?? 24}
                    hint="Tiempo para pagar antes de cancelar"
                  />
                  <Field
                    label="Máx. activas por persona"
                    name="maxActiveBookings"
                    type="number"
                    defaultValue={settings?.maxActiveBookings ?? 5}
                    hint="0 = sin límite"
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
                      defaultValue={settings?.bookingAutoCancelHours ?? 8}
                      hint="Ej: 8 = cancela 8hs antes del turno"
                    />
                  </div>
                </div>
              </>
            )}

            {!depositEnabled && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Slug público"
                  name="publicBookingSlug"
                  defaultValue={settings?.publicBookingSlug ?? ""}
                  hint="Ej: mi-centro — solo minúsculas y guiones. Si se deja vacío, se usa el slug del centro"
                />
                <Field
                  label="WhatsApp para booking"
                  name="waPublicBookingPhone"
                  defaultValue={settings?.waPublicBookingPhone ?? ""}
                  hint="Nro donde los pacientes envían la confirmación. Si no, se usa el del profesional"
                />
                <Field
                  label="Máx. activas por persona"
                  name="maxActiveBookings"
                  type="number"
                  defaultValue={settings?.maxActiveBookings ?? 5}
                  hint="0 = sin límite"
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button disabled={saving} type="submit" size="lg">
          {saving ? "Guardando..." : "Guardar cambios"}
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
