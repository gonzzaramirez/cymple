"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Patient, Appointment } from "@/lib/types";
import {
  Search,
  X,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Activity,
  DollarSign,
  Plus,
  User,
  ChevronRight,
} from "lucide-react";

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info";
  }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  ATTENDED: { label: "Atendido", variant: "success" },
  ABSENT: { label: "Ausente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

type PatientWithAppointments = Patient & {
  _upcoming?: Appointment[];
  _totalSessions?: number;
  _totalBilled?: number;
};

type PatientSearchPreviewProps = {
  onCreateAppointment: (patientId: string, patientName: string) => void;
};

export function PatientSearchPreview({
  onCreateAppointment,
}: PatientSearchPreviewProps) {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PatientWithAppointments | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/backend/patients?query=${encodeURIComponent(search.trim())}&page=1&limit=8`
        );
        if (res.ok) {
          const data = await res.json();
          setPatients(data.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const selectPatient = useCallback(async (patient: Patient) => {
    setSearch("");
    setPatients([]);
    setDetailLoading(true);
    setSelected({ ...patient });

    try {
      const [apptRes, histRes] = await Promise.all([
        fetch(`/api/backend/appointments?patientId=${patient.id}&page=1&limit=10`),
        fetch(`/api/backend/patients/${patient.id}/history`),
      ]);

      const upcoming: Appointment[] = [];
      let totalSessions = 0;
      let totalBilled = 0;

      if (apptRes.ok) {
        const apptData = await apptRes.json();
        const items: Appointment[] = apptData.items ?? [];
        upcoming.push(
          ...items.filter(
            (a) => a.status === "PENDING" || a.status === "CONFIRMED"
          )
        );
      }

      if (histRes.ok) {
        const histData = await histRes.json();
        totalSessions = histData.summary?.totalSessions ?? 0;
        totalBilled = histData.summary?.totalBilled ?? 0;
      }

      setSelected({
        ...patient,
        _upcoming: upcoming,
        _totalSessions: totalSessions,
        _totalBilled: totalBilled,
      });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function clearSelected() {
    setSelected(null);
    setSearch("");
    setPatients([]);
  }

  if (selected) {
    const upcoming = selected._upcoming ?? [];
    const name = `${selected.lastName}, ${selected.firstName}`;

    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {selected.firstName[0]}
                {selected.lastName[0]}
              </div>
              <div>
                <p className="font-semibold">{name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" />
                    {selected.phone}
                  </span>
                  {selected.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      {selected.email}
                    </span>
                  )}
                  {selected.dni && (
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="size-3" />
                      {selected.dni}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={clearSelected}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <Activity className="size-3.5 text-[#34c759]" />
              <span className="text-xs text-muted-foreground">Sesiones</span>
              <span className="ml-auto text-sm font-semibold">
                {selected._totalSessions ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <DollarSign className="size-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Facturado</span>
              <span className="ml-auto text-sm font-mono font-semibold">
                $ {(selected._totalBilled ?? 0).toLocaleString("es-AR")}
              </span>
            </div>
          </div>

          {detailLoading ? (
            <div className="mt-3 flex items-center justify-center py-3">
              <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : upcoming.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Próximos turnos
              </p>
              <div className="space-y-1.5">
                {upcoming.slice(0, 4).map((appt) => {
                  const cfg = statusConfig[appt.status] ?? {
                    label: appt.status,
                    variant: "secondary" as const,
                  };
                  return (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="size-3 text-muted-foreground" />
                        {format(new Date(appt.startAt), "EEE dd/MM HH:mm", {
                          locale: es,
                        })}
                      </span>
                      <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
                {upcoming.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{upcoming.length - 4} más
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground py-2">
              Sin turnos próximos
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onCreateAppointment(selected.id, name)}
            >
              <Plus className="size-3.5" />
              Crear turno
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { window.location.href = `/patients/${selected.id}`; }}
            >
              <User className="size-3.5" />
              Ver ficha
              <ChevronRight className="size-3" />
            </Button>
          </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* shouldFilter=false: el API ya filtra server-side; sin esto cmdk re-filtra
          los resultados en el cliente y descarta coincidencias válidas (acentos, etc.) */}
      <Command shouldFilter={false} className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <CommandInput
            placeholder="Buscar paciente por nombre o teléfono..."
            value={search}
            onValueChange={setSearch}
            className="border-0 focus:ring-0 h-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPatients([]);
              }}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {search.trim().length > 0 && (
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : patients.length === 0 ? (
              <CommandEmpty>No se encontraron pacientes</CommandEmpty>
            ) : (
              <div className="p-1">
                {patients.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.lastName} ${p.firstName} ${p.phone ?? ""}`}
                    onSelect={() => selectPatient(p)}
                    className="cursor-pointer rounded-lg px-3 py-2.5"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.lastName}, {p.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.phone ?? "Sin teléfono"}</p>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  </CommandItem>
                ))}
              </div>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
