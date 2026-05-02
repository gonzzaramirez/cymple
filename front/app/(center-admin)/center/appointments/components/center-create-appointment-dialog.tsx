"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Plus,
  Search,
  UserPlus,
  Video,
} from "lucide-react";
import { AppointmentModality, Patient, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

type ProfessionalOption = { id: string; fullName?: string | null; email?: string | null };
type PatientOption = Pick<Patient, "id" | "firstName" | "lastName" | "phone" | "email" | "dni">;
type Slot = { startAt: string; endAt?: string; remainingCapacity: number | null; hasCapacityLimit: boolean };
type FlowStep = 1 | 2;

type PatientDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dni: string;
  notes: string;
};

const patientSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es requerido"),
  lastName: z.string().trim().min(1, "El apellido es requerido"),
  phone: z.string().regex(/^\+?\d{8,20}$/, "Formato inválido").or(z.literal("")).optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  dni: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
});

function professionalLabel(p: ProfessionalOption): string {
  return p.fullName?.trim() || p.email?.trim() || "Profesional";
}

function patientLabel(p: PatientOption): string {
  return `${p.lastName}, ${p.firstName}`;
}

const emptyDraft: PatientDraft = { firstName: "", lastName: "", phone: "", email: "", dni: "", notes: "" };

export function CenterCreateAppointmentDialog({ professionals }: { professionals: ProfessionalOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>(1);
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [inlineCreate, setInlineCreate] = useState(false);
  const [patientDraft, setPatientDraft] = useState<PatientDraft>(emptyDraft);
  const [patientErrors, setPatientErrors] = useState<Partial<Record<keyof PatientDraft, string>>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({
    professionalId: professionals[0]?.id ?? "",
    patientId: "",
    date: new Date(),
    startAt: "",
    modality: "PRESENCIAL" as AppointmentModality,
    durationMinutes: "",
    fee: "",
    paymentMethod: "" as PaymentMethod | "",
    reason: "",
  });
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const selectedPatient = useMemo(() => patients.find((p) => p.id === form.patientId), [patients, form.patientId]);
  const selectedProfessional = useMemo(() => professionals.find((p) => p.id === form.professionalId), [professionals, form.professionalId]);

  function reset(nextOpen = false) {
    setOpen(nextOpen);
    setStep(1);
    setLoading(false);
    setPatientsLoading(false);
    setSlotsLoading(false);
    setPatients([]);
    setPatientQuery("");
    setInlineCreate(false);
    setPatientDraft(emptyDraft);
    setPatientErrors({});
    setSlots([]);
    setForm({ professionalId: professionals[0]?.id ?? "", patientId: "", date: new Date(), startAt: "", modality: "PRESENCIAL", durationMinutes: "", fee: "", paymentMethod: "", reason: "" });
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Load patients
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPatientsLoading(true);
      const qs = new URLSearchParams({ page: "1", limit: "20" });
      if (patientQuery.trim()) qs.set("query", patientQuery.trim());
      const res = await fetch(`/api/backend/patients?${qs.toString()}`, { signal: controller.signal }).catch(() => null);
      if (!res?.ok) { setPatients([]); setPatientsLoading(false); return; }
      const payload = await res.json();
      setPatients(payload.items ?? []);
      setPatientsLoading(false);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, patientQuery]);

  // Load slots when moving to step 2
  useEffect(() => {
    if (!open || step !== 2 || !form.professionalId) return;
    const controller = new AbortController();
    async function loadSlots() {
      setSlotsLoading(true);
      setSlots([]);
      setForm((prev) => ({ ...prev, startAt: "" }));
      const date = format(form.date, "yyyy-MM-dd");
      const res = await fetch(
        `/api/backend/availability/slots?date=${date}&professionalId=${form.professionalId}`,
        { signal: controller.signal },
      ).catch(() => null);
      if (!res?.ok) { setSlotsLoading(false); return; }
      const payload = await res.json();
      setSlots(payload.slots ?? []);
      setSlotsLoading(false);
    }
    void loadSlots();
    return () => controller.abort();
  }, [open, step, form.professionalId, form.date]);

  // Reload slots when date changes in step 2
  function handleDateChange(date: Date | undefined) {
    if (!date) return;
    setForm((prev) => ({ ...prev, date, startAt: "" }));
  }

  async function createInlinePatient() {
    if (!form.professionalId) { sileo.error({ title: "Seleccioná un profesional" }); return; }
    const result = patientSchema.safeParse(patientDraft);
    if (!result.success) {
      const errors: Partial<Record<keyof PatientDraft, string>> = {};
      for (const issue of result.error.issues) { const key = issue.path[0] as keyof PatientDraft; if (!errors[key]) errors[key] = issue.message; }
      setPatientErrors(errors);
      return;
    }
    setPatientErrors({});
    setLoading(true);
    const data = result.data;
    const res = await fetch("/api/backend/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: data.firstName.trim(), lastName: data.lastName.trim(), phone: data.phone?.trim() || undefined, email: data.email?.trim() || undefined, dni: data.dni?.trim() || undefined, notes: data.notes?.trim() || undefined, professionalId: form.professionalId }),
    });
    setLoading(false);
    if (!res.ok) { sileo.error({ title: await res.text().catch(() => "No se pudo crear el paciente") }); return; }
    const patient = (await res.json()) as PatientOption;
    setPatients((prev) => [patient, ...prev.filter((item) => item.id !== patient.id)]);
    setForm((prev) => ({ ...prev, patientId: patient.id }));
    setInlineCreate(false);
    setPatientDraft(emptyDraft);
    sileo.success({ title: "Paciente creado y seleccionado" });
  }

  function goToStep2() {
    if (!form.professionalId) { sileo.error({ title: "Seleccioná un profesional" }); return; }
    if (!form.patientId) { sileo.error({ title: "Seleccioná o creá un paciente" }); return; }
    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.professionalId || !form.patientId || !form.startAt) {
      sileo.error({ title: "Completá profesional, paciente y horario" });
      return;
    }
    const payload: Record<string, unknown> = {
      professionalId: form.professionalId,
      patientId: form.patientId,
      startAt: form.startAt,
      modality: form.modality,
      reason: form.reason.trim() || undefined,
    };
    if (form.durationMinutes.trim()) payload.durationMinutes = Number(form.durationMinutes);
    if (form.fee.trim()) payload.fee = Number(form.fee);
    if (form.paymentMethod) payload.paymentMethod = form.paymentMethod;

    setLoading(true);
    const res = await fetch("/api/backend/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      sileo.error({ title: await res.text().catch(() => "No se pudo crear el turno") });
      return;
    }
    sileo.success({ title: "Turno creado" });
    reset(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? reset(true) : reset(false))}>
      <DialogTrigger render={<Button><Plus className="size-4" /> Nuevo turno</Button>} />
      <DialogContent className="flex max-h-[92vh] flex-col overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Paso 1 de 2: Elegir profesional y paciente" : "Paso 2 de 2: Fecha, hora y detalles"}
          </DialogTitle>
        </DialogHeader>

        {/* ── PASO 1 ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Profesional */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Profesional</Label>
              <Select
                value={form.professionalId}
                onValueChange={(v) => setForm((prev) => ({ ...prev, professionalId: v ?? "", startAt: "" }))}
              >
                <SelectTrigger className="w-full">
                  {selectedProfessional
                    ? professionalLabel(selectedProfessional)
                    : professionals.length === 0
                      ? "Sin profesionales cargados"
                      : "Seleccioná un profesional"}
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{professionalLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Buscar paciente */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Paciente</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Buscar por nombre, DNI, teléfono o email"
                />
              </div>
              <Select value={form.patientId} onValueChange={(v) => setForm((prev) => ({ ...prev, patientId: v ?? "" }))}>
                <SelectTrigger className="w-full">
                  {selectedPatient
                    ? patientLabel(selectedPatient)
                    : patientsLoading
                      ? "Buscando..."
                      : "Seleccioná un paciente"}
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {patientLabel(p)}{p.dni ? ` · DNI ${p.dni}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPatient && (
                <p className="text-xs text-muted-foreground">✓ {patientLabel(selectedPatient)}</p>
              )}
              <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setInlineCreate((v) => !v)}>
                <UserPlus className="size-4" /> {inlineCreate ? "Cancelar" : "Crear paciente nuevo"}
              </Button>
            </div>

            {/* Inline create */}
            {inlineCreate && (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-semibold">Datos del nuevo paciente</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nombre</Label>
                    <Input value={patientDraft.firstName} onChange={(e) => setPatientDraft((p) => ({ ...p, firstName: e.target.value }))} />
                    {patientErrors.firstName && <p className="text-xs text-destructive">{patientErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Apellido</Label>
                    <Input value={patientDraft.lastName} onChange={(e) => setPatientDraft((p) => ({ ...p, lastName: e.target.value }))} />
                    {patientErrors.lastName && <p className="text-xs text-destructive">{patientErrors.lastName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teléfono <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                    <Input value={patientDraft.phone} onChange={(e) => setPatientDraft((p) => ({ ...p, phone: e.target.value }))} />
                    {patientErrors.phone && <p className="text-xs text-destructive">{patientErrors.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                    <Input type="email" value={patientDraft.email} onChange={(e) => setPatientDraft((p) => ({ ...p, email: e.target.value }))} />
                    {patientErrors.email && <p className="text-xs text-destructive">{patientErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>DNI <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                    <Input value={patientDraft.dni} onChange={(e) => setPatientDraft((p) => ({ ...p, dni: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notas <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                    <Input value={patientDraft.notes} onChange={(e) => setPatientDraft((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <Button size="sm" disabled={loading} onClick={() => void createInlinePatient()}>
                  <Check className="size-4" /> {loading ? "Creando..." : "Crear y seleccionar"}
                </Button>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!form.professionalId || !form.patientId}
              onClick={goToStep2}
            >
              Siguiente <CalendarDays className="ml-2 size-4" />
            </Button>
          </div>
        )}

        {/* ── PASO 2 ─────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={submit} className="space-y-5">
            {/* Resumen */}
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm space-y-0.5">
              <p>Profesional: <span className="font-medium">{selectedProfessional ? professionalLabel(selectedProfessional) : "—"}</span></p>
              <p>Paciente: <span className="font-medium">{selectedPatient ? patientLabel(selectedPatient) : "—"}</span></p>
            </div>

            {/* Modalidad */}
            <div className="space-y-2">
              <Label>Modalidad</Label>
              <div className="flex gap-3">
                {([{ value: "PRESENCIAL" as const, label: "Presencial", icon: MapPin }, { value: "VIRTUAL" as const, label: "Virtual", icon: Video }]).map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => setForm((p) => ({ ...p, modality: value }))} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors", form.modality === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    <Icon className="size-4" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label>Fecha</Label>
              <div className="rounded-xl border border-border p-2">
                <Calendar mode="single" selected={form.date} onSelect={handleDateChange} locale={es} className="w-full" />
              </div>
            </div>

            {/* Horarios */}
            <div className="space-y-2">
              <Label>
                Horarios disponibles — <span className="font-normal text-muted-foreground">{format(form.date, "EEEE d 'de' MMMM", { locale: es })}</span>
              </Label>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1 rounded-xl border border-border p-3">
                {slotsLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando horarios...</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha</p>
                ) : (
                  slots.map((slot) => {
                    const selected = form.startAt === slot.startAt;
                    const disabled = slot.hasCapacityLimit && (slot.remainingCapacity ?? 0) <= 0;
                    return (
                      <button key={slot.startAt} type="button" disabled={disabled} onClick={() => setForm((p) => ({ ...p, startAt: slot.startAt }))} className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition", selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/40", disabled && "cursor-not-allowed opacity-50")}>
                        <span className="inline-flex items-center gap-2 text-sm font-medium"><Clock3 className="size-3.5 text-muted-foreground" />{format(new Date(slot.startAt), "HH:mm")}</span>
                        {slot.hasCapacityLimit && <span className="text-xs text-muted-foreground">{slot.remainingCapacity === 0 ? "Completo" : `${slot.remainingCapacity} cupo(s)`}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
              <Label>Método de pago <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <div className="flex gap-3">
                {([{ value: "CASH" as const, label: "Efectivo", icon: Banknote }, { value: "TRANSFER" as const, label: "Transferencia", icon: ArrowLeftRight }]).map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => setForm((p) => ({ ...p, paymentMethod: p.paymentMethod === value ? "" : value }))} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors", form.paymentMethod === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    <Icon className="size-4" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duración y honorario */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ca-duration">Duración (min) <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="ca-duration" type="number" value={form.durationMinutes} onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ca-fee">Honorario <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="ca-fee" type="number" value={form.fee} onChange={(e) => setForm((p) => ({ ...p, fee: e.target.value }))} />
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="ca-reason">Motivo <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea ref={reasonRef} id="ca-reason" rows={2} className="resize-none overflow-hidden" placeholder="Descripción del motivo de la consulta..." value={form.reason} onInput={(e) => autoResize(e.currentTarget)} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>

            {/* Botones */}
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>Volver</Button>
              <Button disabled={loading || !form.startAt} type="submit" size="lg">
                {loading ? "Guardando..." : "Crear turno"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
