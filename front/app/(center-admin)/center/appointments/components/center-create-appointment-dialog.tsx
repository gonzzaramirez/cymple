"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sileo } from "sileo";

type ProfessionalOption = { id: string; fullName: string };
type PatientOption = { id: string; firstName: string; lastName: string };
type Slot = { startAt: string; remainingCapacity: number | null; hasCapacityLimit: boolean };

export function CenterCreateAppointmentDialog({ professionals }: { professionals: ProfessionalOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({
    professionalId: professionals[0]?.id ?? "",
    patientId: "",
    date: new Date().toISOString().slice(0, 10),
    startAt: "",
    reason: "",
  });

  useEffect(() => {
    if (!open) return;
    void fetch(`/api/backend/patients?page=1&limit=100`)
      .then((r) => r.json())
      .then((data) => setPatients(data.items ?? []))
      .catch(() => setPatients([]));
  }, [open]);

  useEffect(() => {
    if (!open || !form.professionalId || !form.date) return;
    void fetch(`/api/backend/availability/slots?date=${form.date}&professionalId=${form.professionalId}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]));
  }, [open, form.professionalId, form.date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.professionalId || !form.patientId || !form.startAt) {
      sileo.error({ title: "Completá paciente, profesional y horario" });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/backend/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professionalId: form.professionalId,
        patientId: form.patientId,
        startAt: form.startAt,
        reason: form.reason.trim() || undefined,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el turno" });
      return;
    }

    sileo.success({ title: "Turno creado" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Nuevo turno</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo turno del centro</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Profesional</Label>
            <Select value={form.professionalId} onValueChange={(v) => setForm((p) => ({ ...p, professionalId: v ?? "", startAt: "" }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{professionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Paciente</Label>
            <Select value={form.patientId} onValueChange={(v) => setForm((p) => ({ ...p, patientId: v ?? "" }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.lastName}, {p.firstName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value, startAt: "" }))} />
          </div>
          <div>
            <Label>Horario</Label>
            <Select value={form.startAt} onValueChange={(v) => setForm((p) => ({ ...p, startAt: v ?? "" }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {slots.map((s) => {
                  const full = s.hasCapacityLimit && (s.remainingCapacity ?? 0) <= 0;
                  return (
                    <SelectItem key={s.startAt} value={s.startAt} disabled={full}>
                      {new Date(s.startAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      {full ? " (completo)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <Button className="w-full" disabled={loading} type="submit">{loading ? "Guardando..." : "Crear turno"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
