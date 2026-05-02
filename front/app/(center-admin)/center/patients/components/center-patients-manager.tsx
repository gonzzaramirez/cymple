"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeftRight,
  Banknote,
  CalendarPlus,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { ApiList, AppointmentModality, Patient, PaymentMethod } from "@/lib/types";
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
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

type ProfessionalOption = { id: string; fullName?: string | null; email?: string | null };
type SlotItem = {
  startAt: string;
  endAt: string;
  bookedCount: number;
  remainingCapacity: number | null;
  hasCapacityLimit: boolean;
};

const patientSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es requerido"),
  lastName: z.string().trim().min(1, "El apellido es requerido"),
  professionalId: z.string().min(1, "Seleccioná un profesional"),
  phone: z
    .string()
    .regex(/^\+?\d{8,20}$/, "Formato inválido (ej: +5491123456789)")
    .or(z.literal(""))
    .optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  dni: z.string().max(20, "Máximo 20 caracteres").optional(),
  notes: z.string().max(1000, "Máximo 1000 caracteres").optional(),
});

type PatientForm = z.infer<typeof patientSchema>;
type PatientFormErrors = Partial<Record<keyof PatientForm, string>>;
type FlowStep = 1 | 2;

const emptyPatientForm = (professionalId = ""): PatientForm => ({
  firstName: "",
  lastName: "",
  professionalId,
  phone: "",
  email: "",
  dni: "",
  notes: "",
});

function professionalLabel(professional: ProfessionalOption): string {
  return professional.fullName?.trim() || professional.email?.trim() || "Profesional sin nombre";
}

function patientName(patient: Patient): string {
  return `${patient.lastName}, ${patient.firstName}`;
}

function fieldErrorMap(error: z.ZodError<PatientForm>): PatientFormErrors {
  const errors: PatientFormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof PatientFormErrors;
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

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
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [step, setStep] = useState<FlowStep>(1);
  const [fieldErrors, setFieldErrors] = useState<PatientFormErrors>({});
  const [createdPatient, setCreatedPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [patientForm, setPatientForm] = useState<PatientForm>(() => emptyPatientForm(professionals[0]?.id ?? ""));
  const [appointmentForm, setAppointmentForm] = useState({
    selectedDate: new Date(),
    selectedSlotStartAt: "",
    slots: [] as SlotItem[],
    modality: "PRESENCIAL" as AppointmentModality,
    paymentMethod: "" as PaymentMethod | "",
    durationMinutes: "",
    fee: "",
    reason: "",
  });
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === patientForm.professionalId),
    [professionals, patientForm.professionalId],
  );

  function resetFlow(nextOpen = false) {
    setOpen(nextOpen);
    setStep(1);
    setSaving(false);
    setSlotsLoading(false);
    setFieldErrors({});
    setCreatedPatient(null);
    setPatientForm(emptyPatientForm(professionals[0]?.id ?? ""));
    setAppointmentForm({
      selectedDate: new Date(),
      selectedSlotStartAt: "",
      slots: [],
      modality: "PRESENCIAL",
      paymentMethod: "",
      durationMinutes: "",
      fee: "",
      reason: "",
    });
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  async function loadSlots(date: Date, professionalId: string, preserveSelection = false) {
    if (!professionalId) return;
    setSlotsLoading(true);
    const formattedDate = format(date, "yyyy-MM-dd");
    const res = await fetch(
      `/api/backend/availability/slots?date=${formattedDate}&professionalId=${professionalId}`,
    );

    if (!res.ok) {
      setAppointmentForm((prev) => ({ ...prev, slots: [], selectedSlotStartAt: "" }));
      setSlotsLoading(false);
      return;
    }

    const payload = await res.json();
    const nextSlots: SlotItem[] = payload.slots ?? [];
    setAppointmentForm((prev) => ({
      ...prev,
      slots: nextSlots,
      selectedSlotStartAt:
        preserveSelection && nextSlots.some((slot) => slot.startAt === prev.selectedSlotStartAt)
          ? prev.selectedSlotStartAt
          : "",
    }));
    setSlotsLoading(false);
  }

  async function createPatient(e: React.FormEvent) {
    e.preventDefault();
    const result = patientSchema.safeParse(patientForm);
    if (!result.success) {
      setFieldErrors(fieldErrorMap(result.error));
      return;
    }

    setFieldErrors({});
    setSaving(true);
    const data = result.data;
    const res = await fetch("/api/backend/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone?.trim() || undefined,
        email: data.email?.trim() || undefined,
        dni: data.dni?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        professionalId: data.professionalId,
      }),
    });

    if (!res.ok) {
      setSaving(false);
      const detail = await res.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el paciente" });
      return;
    }

    const patient = (await res.json()) as Patient;
    const fullName = patient?.id ? `${patient.lastName}, ${patient.firstName}` : `${data.lastName}, ${data.firstName}`;
    setCreatedPatient({ id: patient.id, fullName });
    await loadSlots(appointmentForm.selectedDate, data.professionalId);
    setStep(2);
    setSaving(false);
    sileo.success({ title: "Paciente creado. Ahora podés asignar el turno." });
    router.refresh();
  }

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!createdPatient?.id || !patientForm.professionalId || !appointmentForm.selectedSlotStartAt) {
      sileo.error({ title: "Completá profesional, paciente y horario" });
      return;
    }

    const payload: Record<string, unknown> = {
      professionalId: patientForm.professionalId,
      patientId: createdPatient.id,
      startAt: appointmentForm.selectedSlotStartAt,
      modality: appointmentForm.modality,
      reason: appointmentForm.reason.trim() || undefined,
    };
    if (appointmentForm.durationMinutes.trim()) payload.durationMinutes = Number(appointmentForm.durationMinutes);
    if (appointmentForm.fee.trim()) payload.fee = Number(appointmentForm.fee);
    if (appointmentForm.paymentMethod) payload.paymentMethod = appointmentForm.paymentMethod;

    setSaving(true);
    const res = await fetch("/api/backend/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el turno" });
      await loadSlots(appointmentForm.selectedDate, patientForm.professionalId, true);
      return;
    }

    sileo.success({ title: "Paciente y turno creados" });
    resetFlow(false);
    router.push("/center/appointments");
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
          <Input name="query" defaultValue={initialQuery} placeholder="Buscar por nombre, DNI, teléfono o email" />
          <Button type="submit">Buscar</Button>
        </form>
        <Dialog open={open} onOpenChange={(next) => (next ? resetFlow(true) : resetFlow(false))}>
          <DialogTrigger render={<Button><Plus className="size-4" /> Nuevo paciente</Button>} />
          <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{step === 1 ? "Paso 1 de 2: Crear paciente" : "Paso 2 de 2: Asignar turno"}</DialogTitle>
            </DialogHeader>
            {step === 1 ? (
              <form onSubmit={createPatient} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Profesional responsable</Label>
                  <Select value={patientForm.professionalId} onValueChange={(value) => {
                    setPatientForm((prev) => ({ ...prev, professionalId: value ?? "" }));
                    setAppointmentForm((prev) => ({ ...prev, selectedSlotStartAt: "", slots: [] }));
                  }}>
                    <SelectTrigger><SelectValue placeholder={professionals.length === 0 ? "Sin profesionales" : "Seleccionar profesional"} /></SelectTrigger>
                    <SelectContent className="z-[200] max-h-60" style={{ pointerEvents: 'auto' }}>
                      {professionals.map((pro) => (
                        <SelectItem key={pro.id} value={pro.id}>{professionalLabel(pro)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.professionalId && <p className="text-xs text-destructive">{fieldErrors.professionalId}</p>}
                </div>
                <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="center-firstName">Nombre</Label>
                    <Input id="center-firstName" value={patientForm.firstName} onChange={(e) => setPatientForm((p) => ({ ...p, firstName: e.target.value }))} />
                    {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="center-lastName">Apellido</Label>
                    <Input id="center-lastName" value={patientForm.lastName} onChange={(e) => setPatientForm((p) => ({ ...p, lastName: e.target.value }))} />
                    {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="center-phone">Teléfono <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                    <Input id="center-phone" type="tel" placeholder="+5491123456789" value={patientForm.phone} onChange={(e) => setPatientForm((p) => ({ ...p, phone: e.target.value }))} />
                    {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="center-email">Email <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                    <Input id="center-email" type="email" value={patientForm.email} onChange={(e) => setPatientForm((p) => ({ ...p, email: e.target.value }))} />
                    {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="center-dni">DNI <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                  <Input id="center-dni" value={patientForm.dni} onChange={(e) => setPatientForm((p) => ({ ...p, dni: e.target.value }))} />
                  {fieldErrors.dni && <p className="text-xs text-destructive">{fieldErrors.dni}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="center-notes">Notas <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                  <Textarea ref={notesRef} id="center-notes" rows={2} placeholder="Alergias, antecedentes, indicaciones especiales..." className="resize-none overflow-hidden" value={patientForm.notes} onInput={(e) => autoResize(e.currentTarget)} onChange={(e) => setPatientForm((p) => ({ ...p, notes: e.target.value }))} />
                  {fieldErrors.notes && <p className="text-xs text-destructive">{fieldErrors.notes}</p>}
                </div>
                <Button className="w-full" size="lg" disabled={saving} type="submit">{saving ? "Guardando..." : "Siguiente"}</Button>
              </form>
            ) : (
              <form onSubmit={createAppointment} className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
                  Paciente: <span className="font-medium">{createdPatient?.fullName}</span><br />
                  Profesional: <span className="font-medium">{selectedProfessional ? professionalLabel(selectedProfessional) : "—"}</span>
                </div>
                <div className="space-y-2">
                  <Label>Modalidad</Label>
                  <div className="flex gap-3">
                    {[{ value: "PRESENCIAL" as const, label: "Presencial", icon: MapPin }, { value: "VIRTUAL" as const, label: "Virtual", icon: Video }].map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" onClick={() => setAppointmentForm((p) => ({ ...p, modality: value }))} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors", appointmentForm.modality === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                        <Icon className="size-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fecha y hora</Label>
                  <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_1.1fr]">
                    <div className="rounded-xl border border-border p-2">
                      <Calendar mode="single" selected={appointmentForm.selectedDate} onSelect={(date) => {
                        if (!date) return;
                        setAppointmentForm((p) => ({ ...p, selectedDate: date, selectedSlotStartAt: "" }));
                        void loadSlots(date, patientForm.professionalId);
                      }} locale={es} className="w-full" />
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Horarios disponibles</p>
                      <p className="mb-3 text-sm font-medium">{format(appointmentForm.selectedDate, "EEEE d 'de' MMMM", { locale: es })}</p>
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {slotsLoading ? <p className="text-sm text-muted-foreground">Cargando horarios...</p> : appointmentForm.slots.length === 0 ? <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha</p> : appointmentForm.slots.map((slot) => {
                          const selected = appointmentForm.selectedSlotStartAt === slot.startAt;
                          const disabled = slot.hasCapacityLimit && (slot.remainingCapacity ?? 0) <= 0;
                          return (
                            <button key={slot.startAt} type="button" disabled={disabled} onClick={() => setAppointmentForm((p) => ({ ...p, selectedSlotStartAt: slot.startAt }))} className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition", selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/40", disabled && "cursor-not-allowed opacity-50")}>
                              <span className="inline-flex items-center gap-2 text-sm font-medium"><Clock3 className="size-3.5 text-muted-foreground" />{format(new Date(slot.startAt), "HH:mm")}</span>
                              {slot.hasCapacityLimit ? <span className="text-xs text-muted-foreground">{slot.remainingCapacity === 0 ? "Completo" : `${slot.remainingCapacity} cupo(s)`}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <div className="flex gap-3">
                    {[{ value: "CASH" as const, label: "Efectivo", icon: Banknote }, { value: "TRANSFER" as const, label: "Transferencia", icon: ArrowLeftRight }].map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" onClick={() => setAppointmentForm((p) => ({ ...p, paymentMethod: value }))} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors", appointmentForm.paymentMethod === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                        <Icon className="size-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="center-appt-duration">Duración (min)</Label><Input id="center-appt-duration" type="number" value={appointmentForm.durationMinutes} onChange={(e) => setAppointmentForm((p) => ({ ...p, durationMinutes: e.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="center-appt-fee">Honorario</Label><Input id="center-appt-fee" type="number" value={appointmentForm.fee} onChange={(e) => setAppointmentForm((p) => ({ ...p, fee: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="center-appt-reason">Motivo</Label><Textarea id="center-appt-reason" rows={2} className="resize-none overflow-hidden" placeholder="Descripción del motivo de consulta..." value={appointmentForm.reason} onInput={(e) => autoResize(e.currentTarget)} onChange={(e) => setAppointmentForm((p) => ({ ...p, reason: e.target.value }))} /></div>
                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>Volver</Button>
                  <Button disabled={saving || !appointmentForm.selectedSlotStartAt} type="submit"><CalendarPlus className="size-4" /> {saving ? "Guardando..." : "Guardar turno"}</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
        <p className="mb-3 text-sm text-muted-foreground">{data.total} pacientes</p>
        <div className="divide-y divide-[var(--border-light)]">
          {data.items.map((patient) => (
            <div key={patient.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{patientName(patient)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{patient.dni ? `DNI ${patient.dni} · ` : ""}{patient.phone ?? patient.email ?? "Sin contacto"}</p>
                {patient.professional?.fullName && <p className="mt-0.5 text-xs text-muted-foreground">Profesional: {patient.professional.fullName}</p>}
                {patient.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{patient.notes}</p>}
              </div>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void removePatient(patient.id)}>
                <Trash2 className="size-4" /> Eliminar
              </Button>
            </div>
          ))}
          {data.items.length === 0 && <p className="py-6 text-sm text-muted-foreground">Sin pacientes</p>}
        </div>
      </div>
    </div>
  );
}
