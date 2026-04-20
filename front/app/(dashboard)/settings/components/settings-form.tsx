"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sileo } from "sileo";
import { ProfessionalSettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: ProfessionalSettings }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const payload = {
      consultationMinutes: Number(formData.get("consultationMinutes")),
      bufferMinutes: Number(formData.get("bufferMinutes")),
      minRescheduleHours: Number(formData.get("minRescheduleHours")),
      standardFee: Number(formData.get("standardFee")),
      reminderHours: Number(formData.get("reminderHours")),
      timezone: formData.get("timezone"),
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
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Parámetros del profesional
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-6">
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
              label="Recordatorio (h antes)"
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
          <div className="flex justify-end">
            <Button disabled={loading} type="submit" size="lg">
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
