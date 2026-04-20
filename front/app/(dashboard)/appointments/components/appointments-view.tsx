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

  // ── Lista: datos propios (no restringidos a "esta semana") ──────────────
  const [listItems, setListItems] = useState<Appointment[] | null>(null);
  const [listLoading, setListLoading] = useState(false);

  // Cuando el servidor devuelve nuevos `items` (tras crear/refrescar), invalidar la lista
  useEffect(() => {
    setListItems(null);
  }, [items]);

  // Invalidar la lista cuando cambian los filtros de URL (search, status, from, to)
  useEffect(() => {
    setListItems(null);
  }, [searchParams]);

  // Fetch de todos los turnos al cambiar a vista lista, propagando los filtros activos de URL
  useEffect(() => {
    if (view !== "table") return;
    if (listItems !== null) return; // ya está cargado
    let cancelled = false;
    setListLoading(true);

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
        if (!cancelled) setListItems(data.items ?? []);
      })
      .catch(() => { if (!cancelled) setListItems([]); })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [view, listItems, searchParams]);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turnos y calendario
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl bg-muted p-1">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = view === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setView(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
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

      <AppointmentFilters
        view={view}
        onCreateAppointment={handleCreateFromPreview}
      />

      {view === "calendar" ? (
        <ScheduleCalendar items={items} selectedDate={initialDate} />
      ) : listLoading ? (
        <div className="flex items-center justify-center rounded-2xl bg-card p-12 shadow-card">
          <p className="text-sm text-muted-foreground">Cargando turnos...</p>
        </div>
      ) : (
        <AppointmentsList items={listItems ?? items} />
      )}
    </div>
  );
}
