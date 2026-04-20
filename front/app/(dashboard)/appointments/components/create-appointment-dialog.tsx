"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
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
import { Calendar } from "@/components/ui/calendar";
import { sileo } from "sileo";
import {
  Plus,
  Clock3,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Search,
  X,
  User,
  ChevronDown,
} from "lucide-react";
import { Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlotItem = {
  startAt: string;
  endAt: string;
  bookedCount: number;
  remainingCapacity: number | null;
  hasCapacityLimit: boolean;
};

export type CreateAppointmentDialogHandle = {
  openWithPatient: (patientId: string, patientName: string) => void;
};

type CreateAppointmentDialogProps = {
  /** Se llama con el startAt ISO del turno creado. Si no se provee, navega a la semana correspondiente. */
  onSuccess?: (startAt: string) => void;
  /** Oculta el botón trigger interno (cuando se controla externamente via ref). */
  hideTrigger?: boolean;
};

export const CreateAppointmentDialog = forwardRef<CreateAppointmentDialogHandle, CreateAppointmentDialogProps>(
  function CreateAppointmentDialog({ onSuccess, hideTrigger = false }, ref) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientLoading, setNewPatientLoading] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDni, setNewDni] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [fee, setFee] = useState("");
  const [reason, setReason] = useState("");

  useImperativeHandle(ref, () => ({
    openWithPatient(patientId: string, patientName: string) {
      setSelectedPatientId(patientId);
      setSelectedPatientName(patientName);
      setShowNewPatient(false);
      setStep(2);
      setOpen(true);
    },
  }));

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const url = search
        ? `/api/backend/patients/search?query=${encodeURIComponent(search)}`
        : `/api/backend/patients?page=1&limit=10`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.items ?? data);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open]);

  useEffect(() => {
    if (!open || !selectedDate) return;
    const controller = new AbortController();

    async function loadSlots() {
      setSlotsLoading(true);
      const date = format(selectedDate, "yyyy-MM-dd");
      const res = await fetch(`/api/backend/availability/slots?date=${date}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        setSlots([]);
        setSelectedSlotStartAt("");
        setSlotsLoading(false);
        return;
      }

      const data = await res.json();
      const nextSlots: SlotItem[] = data.slots ?? [];
      setSlots(nextSlots);
      setSelectedSlotStartAt((prev) => {
        if (prev && nextSlots.some((slot) => slot.startAt === prev))
          return prev;
        return "";
      });
      setSlotsLoading(false);
    }

    loadSlots();
    return () => controller.abort();
  }, [open, selectedDate]);

  function resetForm() {
    setStep(1);
    setSearch("");
    setSelectedPatientId("");
    setSelectedPatientName("");
    setShowNewPatient(false);
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setNewEmail("");
    setNewDni("");
    setNewNotes("");
    setSelectedSlotStartAt("");
    setDurationMinutes("");
    setFee("");
    setReason("");
  }

  function selectPatient(p: Patient) {
    setSelectedPatientId(p.id);
    setSelectedPatientName(`${p.lastName}, ${p.firstName}`);
    setSearch("");
  }

  function clearSelectedPatient() {
    setSelectedPatientId("");
    setSelectedPatientName("");
  }

  async function onCreatePatient() {
    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim()) {
      sileo.error({ title: "Completá nombre, apellido y teléfono" });
      return;
    }
    setNewPatientLoading(true);
    const res = await fetch("/api/backend/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        dni: newDni.trim() || undefined,
        notes: newNotes.trim() || undefined,
      }),
    });
    setNewPatientLoading(false);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el paciente" });
      return;
    }

    const created = await res.json();
    if (!created?.id) {
      sileo.error({ title: "Respuesta inesperada al crear paciente" });
      return;
    }
    setSelectedPatientId(created.id);
    setSelectedPatientName(`${created.lastName}, ${created.firstName}`);
    setShowNewPatient(false);
    sileo.success({ title: "Paciente creado" });
  }

  async function onSubmit() {
    if (!selectedSlotStartAt) {
      sileo.error({ title: "Seleccioná un horario" });
      return;
    }

    setLoading(true);
    const duration = durationMinutes.trim();
    const feeVal = fee.trim();
    const payload: Record<string, unknown> = {
      patientId: selectedPatientId,
      startAt: selectedSlotStartAt,
      reason: reason.trim() || undefined,
    };
    if (duration) payload.durationMinutes = Number(duration);
    if (feeVal) payload.fee = Number(feeVal);

    const response = await fetch("/api/backend/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      sileo.error({ title: detail || "No se pudo crear el turno" });
      const date = format(selectedDate, "yyyy-MM-dd");
      const refetchSlots = await fetch(
        `/api/backend/availability/slots?date=${date}`,
      );
      if (refetchSlots.ok) {
        const updated = await refetchSlots.json();
        setSlots(updated.slots ?? []);
      }
      return;
    }

    setOpen(false);
    resetForm();
    sileo.success({ title: "Turno creado" });
    if (onSuccess) {
      onSuccess(selectedSlotStartAt);
    } else {
      // Sin callback externo: navegar a la semana del turno recién creado
      router.push(`/appointments?date=${encodeURIComponent(selectedSlotStartAt)}`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" />
              Nuevo turno
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Crear turno
            <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  step === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                1
              </span>
              <span className="h-px w-4 bg-border" />
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  step === 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                2
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {selectedPatientId ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <User className="size-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {selectedPatientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paciente seleccionado
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedPatient}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Buscar paciente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o teléfono..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {search && patients.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-background shadow-sm">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 cursor-pointer"
                        onClick={() => selectPatient(p)}
                      >
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {p.firstName[0]}
                          {p.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.lastName}, {p.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.phone}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowNewPatient(!showNewPatient)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
            >
              <UserPlus className="size-4" />
              {showNewPatient ? "Ocultar formulario" : "Paciente nuevo"}
              <ChevronDown
                className={cn(
                  "ml-auto size-4 transition-transform",
                  showNewPatient && "rotate-180",
                )}
              />
            </button>

            {showNewPatient && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-firstName" className="text-xs">
                      Nombre *
                    </Label>
                    <Input
                      id="np-firstName"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="np-lastName" className="text-xs">
                      Apellido *
                    </Label>
                    <Input
                      id="np-lastName"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-phone" className="text-xs">
                    Teléfono *
                  </Label>
                  <Input
                    id="np-phone"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-email" className="text-xs">
                      Email
                    </Label>
                    <Input
                      id="np-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="np-dni" className="text-xs">
                      DNI
                    </Label>
                    <Input
                      id="np-dni"
                      value={newDni}
                      onChange={(e) => setNewDni(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-notes" className="text-xs">
                    Notas
                  </Label>
                  <Input
                    id="np-notes"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                  />
                </div>
                <Button
                  onClick={onCreatePatient}
                  disabled={
                    newPatientLoading ||
                    !newFirstName.trim() ||
                    !newLastName.trim() ||
                    !newPhone.trim()
                  }
                  size="sm"
                  className="w-full"
                >
                  {newPatientLoading ? "Creando..." : "Crear paciente"}
                </Button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                disabled={!selectedPatientId}
                onClick={() => setStep(2)}
                size="lg"
              >
                Siguiente
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <User className="size-4 text-primary" />
              <span className="font-medium">{selectedPatientName}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
              <div className="rounded-xl border border-border p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={es}
                  className="w-full"
                />
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Horarios disponibles
                </p>
                <p className="mb-3 text-sm font-medium">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {slotsLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Cargando horarios...
                    </p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay horarios disponibles para esta fecha
                    </p>
                  ) : (
                    slots.map((slot) => {
                      const isSelected =
                        selectedSlotStartAt === slot.startAt;
                      const isDisabled =
                        slot.hasCapacityLimit &&
                        (slot.remainingCapacity ?? 0) <= 0;
                      const slotLabel = format(
                        new Date(slot.startAt),
                        "HH:mm",
                      );

                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          disabled={isDisabled}
                          onClick={() =>
                            setSelectedSlotStartAt(slot.startAt)
                          }
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/40 hover:bg-muted/40"
                          } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-medium">
                            <Clock3 className="size-3.5 text-muted-foreground" />
                            {slotLabel}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="appt-duration">Duración (min)</Label>
                <Input
                  id="appt-duration"
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-fee">Honorario</Label>
                <Input
                  id="appt-fee"
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-reason">Motivo</Label>
              <Input
                id="appt-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} size="lg">
                <ChevronLeft className="mr-1 size-4" />
                Volver
              </Button>
              <Button
                disabled={loading || !selectedSlotStartAt}
                onClick={onSubmit}
                size="lg"
              >
                {loading ? "Guardando..." : "Guardar turno"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
     </Dialog>
  );
  }
);
