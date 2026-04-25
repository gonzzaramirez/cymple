"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { sileo } from "sileo";
import {
  ArrowLeftRight,
  Banknote,
  Clock3,
  MapPin,
  Plus,
  Video,
} from "lucide-react";
import { AppointmentModality, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const patientSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  phone: z
    .string()
    .regex(/^\+?\d{8,20}$/, "Formato inválido (ej: +5491123456789)")
    .or(z.literal(""))
    .optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  dni: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormErrors = Partial<Record<keyof z.infer<typeof patientSchema>, string>>;

type FlowStep = 1 | 2;
type SlotItem = {
  startAt: string;
  endAt: string;
  bookedCount: number;
  remainingCapacity: number | null;
  hasCapacityLimit: boolean;
};

type CreatePatientDialogProps = {
  onSuccess?: () => void;
};

export function CreatePatientDialog({ onSuccess }: CreatePatientDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [step, setStep] = useState<FlowStep>(1);
  const [fieldErrors, setFieldErrors] = useState<PatientFormErrors>({});
  const [createdPatient, setCreatedPatient] = useState<{
    id: string;
    fullName: string;
  } | null>(null);
  const [patientForm, setPatientForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dni: "",
    notes: "",
  });
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

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function resetFlow() {
    setOpen(false);
    setStep(1);
    setLoading(false);
    setFieldErrors({});
    setCreatedPatient(null);
    setPatientForm({ firstName: "", lastName: "", phone: "", email: "", dni: "", notes: "" });
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

  async function onCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    const result = patientSchema.safeParse(patientForm);
    if (!result.success) {
      const errors: PatientFormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PatientFormErrors;
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const data = result.data;
    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      dni: data.dni?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    };

    const response = await fetch("/api/backend/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setLoading(false);
      const detail = await response.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el paciente" });
      return;
    }

    const patient = await response.json();
    if (!patient?.id) {
      setLoading(false);
      sileo.error({ title: "Respuesta inesperada al crear paciente" });
      return;
    }

    const fullName =
      patient.lastName && patient.firstName
        ? `${patient.lastName}, ${patient.firstName}`
        : "Paciente nuevo";

    setCreatedPatient({ id: patient.id, fullName });
    await loadSlots(appointmentForm.selectedDate);
    setStep(2);
    setLoading(false);
    sileo.success({ title: "Paciente creado. Ahora asigná el turno." });
    onSuccess?.();
    router.refresh();
  }

  async function loadSlots(date: Date, preserveSelection = false) {
    setSlotsLoading(true);
    const formattedDate = format(date, "yyyy-MM-dd");
    const res = await fetch(`/api/backend/availability/slots?date=${formattedDate}`);

    if (!res.ok) {
      setAppointmentForm((prev) => ({ ...prev, slots: [], selectedSlotStartAt: "" }));
      setSlotsLoading(false);
      return;
    }

    const data = await res.json();
    const nextSlots: SlotItem[] = data.slots ?? [];
    setAppointmentForm((prev) => ({
      ...prev,
      slots: nextSlots,
      selectedSlotStartAt:
        preserveSelection &&
        prev.selectedSlotStartAt &&
        nextSlots.some((slot) => slot.startAt === prev.selectedSlotStartAt)
          ? prev.selectedSlotStartAt
          : "",
    }));
    setSlotsLoading(false);
  }

  async function onCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!createdPatient?.id) {
      sileo.error({ title: "Falta el paciente, volvé al paso 1" });
      return;
    }
    if (!appointmentForm.selectedSlotStartAt) {
      sileo.error({ title: "Seleccioná un horario" });
      return;
    }

    setLoading(true);
    const duration = appointmentForm.durationMinutes.trim();
    const feeVal = appointmentForm.fee.trim();
    const reasonVal = appointmentForm.reason.trim();
    const payload: Record<string, unknown> = {
      patientId: createdPatient.id,
      startAt: appointmentForm.selectedSlotStartAt,
      reason: reasonVal || undefined,
      modality: appointmentForm.modality,
    };
    if (duration) payload.durationMinutes = Number(duration);
    if (feeVal) payload.fee = Number(feeVal);
    if (appointmentForm.paymentMethod) {
      payload.paymentMethod = appointmentForm.paymentMethod;
    }

    const response = await fetch("/api/backend/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el turno" });
      await loadSlots(appointmentForm.selectedDate, true);
      return;
    }

    sileo.success({ title: "Turno creado" });
    router.refresh();
    resetFlow();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) { resetFlow(); return; }
        setOpen(true);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Nuevo paciente
          </Button>
        }
      />
      <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Paso 1 de 2: Crear paciente" : "Paso 2 de 2: Asignar turno"}
          </DialogTitle>
        </DialogHeader>
        {step === 1 ? (
          <form onSubmit={onCreatePatient} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-firstName">Nombre</Label>
                <Input
                  id="create-firstName"
                  value={patientForm.firstName}
                  onChange={(e) =>
                    setPatientForm((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-lastName">Apellido</Label>
                <Input
                  id="create-lastName"
                  value={patientForm.lastName}
                  onChange={(e) =>
                    setPatientForm((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-phone">
                  Teléfono{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="create-phone"
                  type="tel"
                  placeholder="+5491123456789"
                  value={patientForm.phone}
                  onChange={(e) =>
                    setPatientForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-email">
                  Email{" "}
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  value={patientForm.email}
                  onChange={(e) =>
                    setPatientForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-dni">
                DNI{" "}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="create-dni"
                value={patientForm.dni}
                onChange={(e) =>
                  setPatientForm((prev) => ({ ...prev, dni: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-notes">
                Notas{" "}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                ref={notesRef}
                id="create-notes"
                rows={2}
                placeholder="Alergias, antecedentes, indicaciones especiales..."
                className="resize-none overflow-hidden"
                value={patientForm.notes}
                onInput={(e) => autoResize(e.currentTarget)}
                onChange={(e) =>
                  setPatientForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button disabled={loading} type="submit" size="lg" className="w-full sm:w-auto">
                {loading ? "Guardando..." : "Siguiente"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={onCreateAppointment} className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
              Paciente asignado:{" "}
              <span className="font-medium">{createdPatient?.fullName ?? "Paciente nuevo"}</span>
            </div>
            <div className="space-y-2">
              <Label>Modalidad</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      modality: "PRESENCIAL",
                    }))
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                    appointmentForm.modality === "PRESENCIAL"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <MapPin className="size-4" />
                  Presencial
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      modality: "VIRTUAL",
                    }))
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                    appointmentForm.modality === "VIRTUAL"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Video className="size-4" />
                  Virtual
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      paymentMethod: "CASH",
                    }))
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                    appointmentForm.paymentMethod === "CASH"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Banknote className="size-4" />
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      paymentMethod: "TRANSFER",
                    }))
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                    appointmentForm.paymentMethod === "TRANSFER"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <ArrowLeftRight className="size-4" />
                  Transferencia
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
                <div className="rounded-xl border border-border p-2">
                  <Calendar
                    mode="single"
                    selected={appointmentForm.selectedDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setAppointmentForm((prev) => ({ ...prev, selectedDate: date }));
                      void loadSlots(date);
                    }}
                    locale={es}
                    className="w-full"
                  />
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Horarios disponibles
                  </p>
                  <p className="mb-3 text-sm font-medium">
                    {format(appointmentForm.selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {slotsLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando horarios...</p>
                    ) : appointmentForm.slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay horarios disponibles para esta fecha
                      </p>
                    ) : (
                      appointmentForm.slots.map((slot) => {
                        const isSelected = appointmentForm.selectedSlotStartAt === slot.startAt;
                        const isDisabled =
                          slot.hasCapacityLimit && (slot.remainingCapacity ?? 0) <= 0;
                        return (
                          <button
                            key={slot.startAt}
                            type="button"
                            disabled={isDisabled}
                            onClick={() =>
                              setAppointmentForm((prev) => ({
                                ...prev,
                                selectedSlotStartAt: slot.startAt,
                              }))
                            }
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                            } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <span className="inline-flex items-center gap-2 text-sm font-medium">
                              <Clock3 className="size-3.5 text-muted-foreground" />
                              {format(new Date(slot.startAt), "HH:mm")}
                            </span>
                            {slot.hasCapacityLimit ? (
                              <span className="text-xs text-muted-foreground">
                                {slot.remainingCapacity === 0
                                  ? "Completo"
                                  : `${slot.remainingCapacity} cupo(s)`}
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="appt-duration">Duración (min)</Label>
                <Input
                  id="appt-duration"
                  type="number"
                  value={appointmentForm.durationMinutes}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, durationMinutes: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-fee">Honorario</Label>
                <Input
                  id="appt-fee"
                  type="number"
                  value={appointmentForm.fee}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, fee: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-reason">Motivo</Label>
              <Input
                id="appt-reason"
                value={appointmentForm.reason}
                onChange={(e) =>
                  setAppointmentForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Volver
              </Button>
              <Button
                disabled={loading || !appointmentForm.selectedSlotStartAt}
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
              >
                {loading ? "Guardando..." : "Guardar turno"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
