"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiList, Patient } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sileo } from "sileo";

type ProfessionalOption = { id: string; fullName: string };

export function CenterPatientsManager({
  data,
  professionals,
  initialQuery,
  limit,
}: {
  data: ApiList<Patient>;
  professionals: ProfessionalOption[];
  initialQuery: string;
  limit: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    professionalId: professionals[0]?.id ?? "",
  });

  async function createPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.professionalId) {
      sileo.error({ title: "Seleccioná un profesional" });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/backend/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        professionalId: form.professionalId,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el paciente" });
      return;
    }

    sileo.success({ title: "Paciente creado" });
    setOpen(false);
    setForm({ firstName: "", lastName: "", phone: "", email: "", professionalId: professionals[0]?.id ?? "" });
    router.refresh();
  }

  async function removePatient(patientId: string) {
    const ok = confirm("¿Eliminar paciente? Se bloqueará si tiene turnos futuros.");
    if (!ok) return;
    const res = await fetch(`/api/backend/patients/${patientId}`, { method: "DELETE" });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo eliminar" });
      return;
    }
    sileo.success({ title: "Paciente eliminado" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="get" action="/center/patients" className="flex w-full gap-2">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="limit" value={String(limit)} />
          <Input name="query" defaultValue={initialQuery} placeholder="Buscar paciente" />
          <Button type="submit">Buscar</Button>
        </form>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>Nuevo paciente</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear paciente</DialogTitle>
            </DialogHeader>
            <form onSubmit={createPatient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input required value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input required value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Profesional</Label>
                <Select value={form.professionalId} onValueChange={(v) => setForm((p) => ({ ...p, professionalId: v ?? "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((pro) => (
                      <SelectItem key={pro.id} value={pro.id}>{pro.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
        <p className="mb-3 text-sm text-muted-foreground">{data.total} pacientes</p>
        <div className="divide-y divide-[var(--border-light)]">
          {data.items.map((patient) => (
            <div key={patient.id} className="flex items-center justify-between py-3 gap-3">
              <div>
                <p className="text-sm font-medium">{patient.lastName}, {patient.firstName}</p>
                <p className="text-xs text-muted-foreground">{patient.phone ?? patient.email ?? "Sin contacto"}</p>
              </div>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void removePatient(patient.id)}>
                Eliminar
              </Button>
            </div>
          ))}
          {data.items.length === 0 && <p className="py-6 text-sm text-muted-foreground">Sin pacientes</p>}
        </div>
      </div>
    </div>
  );
}
