"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, List } from "lucide-react";
import { AppointmentFilters } from "./appointment-filters";
import { ScheduleCalendar } from "./schedule-calendar";
import { AppointmentsList } from "./appointments-list";
import { CreateAppointmentDialog, CreateAppointmentDialogHandle } from "./create-appointment-dialog";
import { Appointment } from "@/lib/types";

const VIEW_OPTIONS = [
  { value: "calendar", label: "Calendario", icon: Calendar },
  { value: "table", label: "Lista", icon: List },
] as const;

type ViewValue = (typeof VIEW_OPTIONS)[number]["value"];

type AppointmentsViewProps = {
  items: Appointment[];
  /** ISO date string del servidor para anclar la vista inicial del calendario. */
  initialDate: string;
};

export function AppointmentsView({ items, initialDate }: AppointmentsViewProps) {
  const [view, setView] = useState<ViewValue>("calendar");
  const createDialogRef = useRef<CreateAppointmentDialogHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmedCount = items.filter((item) => item.status === "CONFIRMED").length;
  const pendingCount = items.filter((item) => item.status === "PENDING").length;

  // ── Lista: datos propios (no restringidos a "esta semana") ──────────────
  const listKey = `${searchParams.toString()}|${items.map((item) => item.id).join(",")}`;
  const [listState, setListState] = useState<{
    key: string;
    items: Appointment[];
  } | null>(null);

  // Fetch de todos los turnos al cambiar a vista lista, propagando los filtros activos de URL
  useEffect(() => {
    if (view !== "table") return;
    if (listState?.key === listKey) return; // ya está cargado
    let cancelled = false;

    const params = new URLSearchParams();
    params.set("limit", "100");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (search) params.set("search", search);
    if (status) {
      for (const s of status.split(",").map((x) => x.trim()).filter(Boolean)) {
        params.append("status", s);
      }
    }
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/backend/appointments?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { items?: Appointment[] }) => {
        if (!cancelled) {
          setListState({ key: listKey, items: data.items ?? [] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListState({ key: listKey, items: [] });
        }
      });
    return () => { cancelled = true; };
  }, [view, listState?.key, listKey, searchParams]);

  // Tras crear un turno, navegar a la semana que lo contiene
  const handleAppointmentCreated = useCallback(
    (startAt: string) => {
      // Navegar a la semana del turno: el servidor refetcheará con esa fecha
      router.push(`/appointments?date=${encodeURIComponent(startAt)}`);
    },
    [router],
  );

  const handleCreateFromPreview = useCallback(
    (patientId: string, patientName: string) => {
      createDialogRef.current?.openWithPatient(patientId, patientName);
    },
    [],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-card p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              Operación diaria
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Agenda
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Turnos, estados y búsqueda rápida de pacientes.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex w-full items-center rounded-xl bg-muted p-1 sm:w-auto">
              {VIEW_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = view === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setView(opt.value)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all sm:flex-none ${
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <CreateAppointmentDialog ref={createDialogRef} onSuccess={handleAppointmentCreated} />
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              En rango
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{items.length}</p>
          </div>
          <div className="rounded-2xl bg-muted/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Confirmados
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{confirmedCount}</p>
          </div>
          <div className="rounded-2xl bg-muted/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Pendientes
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{pendingCount}</p>
          </div>
        </div>
      </div>

      <AppointmentFilters
        view={view}
        onCreateAppointment={handleCreateFromPreview}
      />

      {view === "calendar" ? (
        <ScheduleCalendar items={items} selectedDate={initialDate} />
      ) : listState?.key !== listKey ? (
        <div className="flex items-center justify-center rounded-2xl bg-card p-12 shadow-card">
          <p className="text-sm text-muted-foreground">Cargando turnos...</p>
        </div>
      ) : (
        <AppointmentsList items={listState.items} />
      )}
    </div>
  );
}
