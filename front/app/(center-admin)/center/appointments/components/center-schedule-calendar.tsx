"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "temporal-polyfill/global";
import {
  createViewDay,
  createViewMonthAgenda,
  createViewWeek,
  type CalendarEvent,
} from "@schedule-x/calendar";
import { createCurrentTimePlugin } from "@schedule-x/current-time";
import { createEventModalPlugin } from "@schedule-x/event-modal";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Appointment } from "@/lib/types";

type CalendarLayout = "resource" | "compact";

type ConflictInfo = {
  hasConflict: boolean;
  groupId?: string;
  count?: number;
};

type CalendarEventExt = CalendarEvent & {
  appointment: Appointment;
  professionalId: string;
  professionalName: string;
  conflictInfo: ConflictInfo;
};

const PROFESSIONAL_COLORS = [
  {
    light: { main: "#7c3aed", container: "#ede9fe", onContainer: "#5b21b6" },
    dark: { main: "#a78bfa", container: "#1e1b4b", onContainer: "#c4b5fd" },
  },
  {
    light: { main: "#0891b2", container: "#cffafe", onContainer: "#0e7490" },
    dark: { main: "#22d3ee", container: "#083344", onContainer: "#a5f3fc" },
  },
  {
    light: { main: "#d97706", container: "#fef3c7", onContainer: "#b45309" },
    dark: { main: "#fbbf24", container: "#451a03", onContainer: "#fde68a" },
  },
  {
    light: { main: "#059669", container: "#d1fae5", onContainer: "#047857" },
    dark: { main: "#34d399", container: "#022c22", onContainer: "#6ee7b7" },
  },
  {
    light: { main: "#dc2626", container: "#fee2e2", onContainer: "#b91c1c" },
    dark: { main: "#f87171", container: "#4c0519", onContainer: "#fca5a5" },
  },
  {
    light: { main: "#db2777", container: "#fce7f3", onContainer: "#be185d" },
    dark: { main: "#f472b6", container: "#500724", onContainer: "#fbcfe8" },
  },
];

const TIMEZONE = "America/Argentina/Buenos_Aires";
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const MINUTE_HEIGHT = 1.1;

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function professionalInitials(fullName?: string): string {
  if (!fullName) return "?";
  const tokens = fullName.trim().split(/\s+/).slice(0, 2);
  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("");
}

function toCalendarDateValue(date: Date): CalendarEvent["start"] {
  const T = globalThis.Temporal;
  if (!T?.Instant?.fromEpochMilliseconds) {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(date).slice(0, 16) as unknown as CalendarEvent["start"];
  }
  const instant = T.Instant.fromEpochMilliseconds(date.getTime());
  return instant.toZonedDateTimeISO(TIMEZONE) as unknown as CalendarEvent["start"];
}

function getVisibleAppointments(items: Appointment[]): Appointment[] {
  return items.filter((a) => a.status !== "CANCELLED");
}

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function detectConflicts(items: Appointment[]): Map<string, ConflictInfo> {
  const byProfessional = new Map<string, Appointment[]>();
  for (const item of items) {
    const list = byProfessional.get(item.professionalId) ?? [];
    list.push(item);
    byProfessional.set(item.professionalId, list);
  }

  const conflicts = new Map<string, ConflictInfo>();

  for (const [professionalId, appointments] of byProfessional.entries()) {
    const sorted = [...appointments].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

    let groupCounter = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const currentStart = new Date(current.startAt).getTime();
      const currentEnd = new Date(current.endAt).getTime();

      const overlappingIds = [current.id];
      for (let j = i + 1; j < sorted.length; j += 1) {
        const next = sorted[j];
        const nextStart = new Date(next.startAt).getTime();
        const nextEnd = new Date(next.endAt).getTime();

        const overlaps = currentStart < nextEnd && currentEnd > nextStart;
        if (!overlaps && nextStart >= currentEnd) break;
        if (overlaps) overlappingIds.push(next.id);
      }

      if (overlappingIds.length > 1) {
        groupCounter += 1;
        const groupId = `conf-${safeId(professionalId)}-${groupCounter}`;
        for (const id of overlappingIds) {
          conflicts.set(id, {
            hasConflict: true,
            groupId,
            count: overlappingIds.length,
          });
        }
      }
    }
  }

  return conflicts;
}

function buildCalendarEvent(
  appointment: Appointment,
  layout: CalendarLayout,
  conflictInfo: ConflictInfo,
): CalendarEventExt {
  const patientName = appointment.patient
    ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
    : "Sin paciente";
  const professionalName = appointment.professional?.fullName ?? "Profesional";
  const compactPrefix = layout === "compact" ? `[${professionalInitials(professionalName)}] ` : "";
  const conflictPrefix = conflictInfo.hasConflict ? "? " : "";

  return {
    id: safeId(appointment.id),
    title: `${conflictPrefix}${compactPrefix}${patientName}`,
    start: toCalendarDateValue(new Date(appointment.startAt)),
    end: toCalendarDateValue(new Date(appointment.endAt)),
    calendarId: `prof-${safeId(appointment.professionalId)}`,
    _options: { disableDND: true, disableResize: true },
    appointment,
    professionalId: appointment.professionalId,
    professionalName,
    conflictInfo,
  };
}

function buildQueryParams(params: URLSearchParams, next: Record<string, string | undefined>) {
  const cloned = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === "") {
      cloned.delete(key);
    } else {
      cloned.set(key, value);
    }
  }
  return cloned.toString();
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHm(date: Date): string {
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

type Props = {
  items: Appointment[];
  professionals: { id: string; fullName: string }[];
  selectedDate: string;
  initialLayout: CalendarLayout;
  initialProfessionalIds: string[];
};

export function CenterScheduleCalendar({
  items,
  professionals,
  selectedDate,
  initialLayout,
  initialProfessionalIds,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const searchParamsRef = useRef(searchParams);
  const routerRef = useRef(router);

  const [layout, setLayout] = useState<CalendarLayout>(initialLayout);
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>(
    initialProfessionalIds,
  );
  const [focusedDate, setFocusedDate] = useState<Date>(parseDate(selectedDate));
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    setFocusedDate(parseDate(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    const stored = localStorage.getItem("center:agenda-layout");
    if (stored === "resource" || stored === "compact") {
      setLayout(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("center:agenda-layout", layout);
  }, [layout]);

  const defaultMobileProfessionalId = professionals[0]?.id;

  useEffect(() => {
    if (isMobile && selectedProfessionals.length === 0 && defaultMobileProfessionalId) {
      setSelectedProfessionals([defaultMobileProfessionalId]);
    }
  }, [isMobile, selectedProfessionals.length, defaultMobileProfessionalId]);

  const visibleAppointments = useMemo(() => getVisibleAppointments(items), [items]);

  const filteredItems = useMemo(() => {
    if (selectedProfessionals.length === 0) return visibleAppointments;
    return visibleAppointments.filter((appointment) =>
      selectedProfessionals.includes(appointment.professionalId),
    );
  }, [visibleAppointments, selectedProfessionals]);

  const conflictMap = useMemo(() => detectConflicts(visibleAppointments), [visibleAppointments]);

  const conflictCountByProfessional = useMemo(() => {
    const counters = new Map<string, number>();
    for (const appointment of visibleAppointments) {
      const conflict = conflictMap.get(appointment.id);
      if (!conflict?.hasConflict) continue;
      counters.set(
        appointment.professionalId,
        (counters.get(appointment.professionalId) ?? 0) + 1,
      );
    }
    return counters;
  }, [conflictMap, visibleAppointments]);

  const calendars = useMemo(() => {
    const result: Record<
      string,
      {
        colorName: string;
        lightColors: { main: string; container: string; onContainer: string };
        darkColors: { main: string; container: string; onContainer: string };
      }
    > = {};
    professionals.forEach((professional, index) => {
      const colors = PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
      result[`prof-${safeId(professional.id)}`] = {
        colorName: professional.fullName,
        lightColors: colors.light,
        darkColors: colors.dark,
      };
    });
    return result;
  }, [professionals]);

  const events = useMemo(
    () =>
      filteredItems.map((appointment) => {
        const conflictInfo = conflictMap.get(appointment.id) ?? { hasConflict: false };
        return buildCalendarEvent(appointment, layout, conflictInfo);
      }),
    [filteredItems, conflictMap, layout],
  );

  const queryView = searchParams.get("view");
  const resolvedView =
    queryView === "day" || queryView === "month" || queryView === "week"
      ? queryView
      : isMobile
        ? "day"
        : "week";

  const selectedPlainDate = useMemo(() => {
    const T = globalThis.Temporal;
    if (!T?.PlainDate?.from) return undefined;
    try {
      return T.PlainDate.from(selectedDate.split("T")[0]);
    } catch {
      return undefined;
    }
  }, [selectedDate]);

  const eventModal = useMemo(() => createEventModalPlugin(), []);
  const currentTime = useMemo(() => createCurrentTimePlugin(), []);

  const calendarApp = useNextCalendarApp({
    views: [createViewWeek(), createViewDay(), createViewMonthAgenda()],
    defaultView: resolvedView,
    ...(selectedPlainDate ? { selectedDate: selectedPlainDate } : {}),
    locale: "es-AR",
    timezone: TIMEZONE,
    firstDayOfWeek: 1,
    dayBoundaries: { start: "07:00", end: "21:00" },
    weekOptions: {
      gridHeight: isMobile ? 520 : 620,
      nDays: 7,
      eventWidth: layout === "compact" ? 96 : 92,
      gridStep: 30,
    },
    calendars,
    events,
    plugins: [eventModal, currentTime],
    skipValidation: true,
    callbacks: {
      onEventClick: (event: CalendarEvent) => {
        const extendedEvent = event as CalendarEventExt;
        if (extendedEvent.appointment) {
          setSelectedAppointment(extendedEvent.appointment);
          setModalOpen(true);
        }
      },
      onClickDateTime: () => setModalOpen(false),
      onRangeUpdate: (range) => {
        const epochMs = range.start.toInstant().epochMilliseconds;
        const targetDate = new Date(epochMs);
        setFocusedDate(targetDate);
        const professionalIds = selectedProfessionals.join(",");
        const queryString = buildQueryParams(searchParamsRef.current, {
          date: targetDate.toISOString(),
          ui: "calendar",
          view: resolvedView,
          layout,
          professionalIds,
        });
        routerRef.current.push(`/center/appointments?${queryString}`);
      },
    },
    translations: {
      "es-AR": {
        Today: "Hoy",
        today: "Hoy",
        Week: "Semana",
        week: "Semana",
        Day: "D�a",
        Month: "Mes",
        Date: "Fecha",
        date: "Fecha",
        "No events": "Sin turnos",
        "Next period": "Siguiente",
        "Previous period": "Anterior",
        "Select View": "Vista",
        View: "Vista",
        to: "a",
      },
    },
  });

  useEffect(() => {
    if (!calendarApp) return;
    calendarApp.events.set(events);
  }, [calendarApp, events]);

  useEffect(() => {
    const professionalIds = selectedProfessionals.join(",");
    const queryString = buildQueryParams(searchParamsRef.current, {
      layout,
      professionalIds,
    });
    routerRef.current.replace(`/center/appointments?${queryString}`);
  }, [layout, selectedProfessionals]);

  function toggleProfessional(professionalId: string) {
    if (isMobile) {
      setSelectedProfessionals([professionalId]);
      return;
    }

    if (selectedProfessionals.length === 0) {
      setSelectedProfessionals([professionalId]);
      return;
    }

    if (selectedProfessionals.includes(professionalId)) {
      const next = selectedProfessionals.filter((id) => id !== professionalId);
      setSelectedProfessionals(next);
      return;
    }

    setSelectedProfessionals([...selectedProfessionals, professionalId]);
  }

  const activeProfessionals = useMemo(() => {
    if (selectedProfessionals.length === 0) return professionals;
    return professionals.filter((prof) => selectedProfessionals.includes(prof.id));
  }, [professionals, selectedProfessionals]);

  const resourceAppointments = useMemo(() => {
    const startBoundary = new Date(focusedDate);
    startBoundary.setHours(0, 0, 0, 0);
    const endBoundary = new Date(startBoundary);
    endBoundary.setDate(endBoundary.getDate() + 1);

    return filteredItems.filter((appointment) => {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);
      return start < endBoundary && end > startBoundary && sameDay(start, focusedDate);
    });
  }, [filteredItems, focusedDate]);

  const hours = useMemo(
    () =>
      Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, index) =>
        String(DAY_START_HOUR + index).padStart(2, "0") + ":00",
      ),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-card px-3 py-2 shadow-card">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Vista:</span>
        <button
          onClick={() => setLayout("resource")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            layout === "resource" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
          }`}
        >
          Recursos
        </button>
        <button
          onClick={() => setLayout("compact")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            layout === "compact" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
          }`}
        >
          Compacta
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-card px-3 py-2 shadow-card">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Profesionales:</span>
        {professionals.map((professional, index) => {
          const isActive =
            selectedProfessionals.length === 0 ||
            selectedProfessionals.includes(professional.id);
          const colors = PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
          const conflictCount = conflictCountByProfessional.get(professional.id) ?? 0;

          return (
            <button
              key={professional.id}
              onClick={() => toggleProfessional(professional.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                isActive ? "text-white" : "opacity-60 hover:opacity-80"
              }`}
              style={
                isActive
                  ? { backgroundColor: colors.light.main }
                  : {
                      backgroundColor: colors.light.container,
                      color: colors.light.onContainer,
                    }
              }
              title={`Filtrar por ${professional.fullName}`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/85 text-[10px] font-bold text-slate-700">
                {professionalInitials(professional.fullName)}
              </span>
              <span>{professional.fullName}</span>
              {conflictCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  ? {conflictCount}
                </span>
              )}
            </button>
          );
        })}
        {!isMobile && selectedProfessionals.length > 0 && (
          <button
            onClick={() => setSelectedProfessionals([])}
            className="ml-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {layout === "resource" && !isMobile ? (
        <div className="space-y-3 rounded-2xl bg-card p-3 shadow-card ring-border">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
            <h3 className="text-sm font-semibold">
              Agenda por profesional � {focusedDate.toLocaleDateString("es-AR", { dateStyle: "full" })}
            </h3>
          </div>

          <div className="grid min-w-[960px] grid-cols-[72px_repeat(var(--cols),minmax(220px,1fr))] overflow-x-auto rounded-xl border border-[var(--border)]" style={{ ["--cols" as string]: String(Math.max(activeProfessionals.length, 1)) }}>
            <div className="sticky left-0 z-20 border-r border-[var(--border)] bg-muted px-2 py-2 text-xs font-medium text-muted-foreground">
              Hora
            </div>
            {activeProfessionals.map((professional, index) => {
              const colors = PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
              return (
                <div key={professional.id} className="border-r border-[var(--border)] bg-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: colors.light.main }}>
                      {professionalInitials(professional.fullName)}
                    </span>
                    <span className="truncate text-sm font-semibold">{professional.fullName}</span>
                  </div>
                </div>
              );
            })}

            <div className="relative border-r border-[var(--border)] bg-background">
              {hours.map((hour, idx) => (
                <div key={hour} className="border-t border-[var(--border)] px-2 pt-1 text-[11px] text-muted-foreground" style={{ height: `${60 * MINUTE_HEIGHT}px` }}>
                  {hour}
                </div>
              ))}
            </div>

            {activeProfessionals.map((professional, index) => {
              const columnAppointments = resourceAppointments.filter((appointment) => appointment.professionalId === professional.id);
              const colors = PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
              return (
                <div key={professional.id} className="relative border-r border-[var(--border)] bg-background" style={{ minHeight: `${(DAY_END_HOUR - DAY_START_HOUR) * 60 * MINUTE_HEIGHT}px` }}>
                  {hours.map((hour) => (
                    <div key={`${professional.id}-${hour}`} className="border-t border-[var(--border)]" style={{ height: `${60 * MINUTE_HEIGHT}px` }} />
                  ))}

                  {columnAppointments.map((appointment) => {
                    const start = new Date(appointment.startAt);
                    const end = new Date(appointment.endAt);
                    const startMinutes = start.getHours() * 60 + start.getMinutes();
                    const endMinutes = end.getHours() * 60 + end.getMinutes();
                    const dayStartMinutes = DAY_START_HOUR * 60;
                    const top = Math.max(0, startMinutes - dayStartMinutes) * MINUTE_HEIGHT;
                    const height = Math.max(30, (endMinutes - startMinutes) * MINUTE_HEIGHT);
                    const conflict = conflictMap.get(appointment.id);
                    const patientName = appointment.patient
                      ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
                      : "Sin paciente";

                    return (
                      <button
                        key={appointment.id}
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setModalOpen(true);
                        }}
                        title={
                          conflict?.hasConflict
                            ? `Conflicto con ${conflict.count ?? 2} turnos`
                            : `${formatHm(start)} - ${formatHm(end)}`
                        }
                        className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left text-xs shadow-sm ${
                          conflict?.hasConflict ? "border-red-400 ring-1 ring-red-300" : "border-transparent"
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: colors.light.container,
                          color: colors.light.onContainer,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold">{patientName}</span>
                          {conflict?.hasConflict && (
                            <span className="rounded-full bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700">
                              ? {conflict.count}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] opacity-80">
                          {formatHm(start)} - {formatHm(end)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className={`sx-calendar-wrapper overflow-hidden rounded-2xl bg-card shadow-card ring-border ${
            layout === "compact" ? "sx-layout-compact" : "sx-layout-resource"
          }`}
          data-mobile={isMobile ? "true" : "false"}
        >
          {calendarApp && <ScheduleXCalendar calendarApp={calendarApp} />}
        </div>
      )}

      {modalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated ring-border">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {selectedAppointment.patient?.firstName} {selectedAppointment.patient?.lastName}
                </h3>
                {selectedAppointment.professional?.fullName && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Profesional: {selectedAppointment.professional.fullName}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedAppointment(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ?
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-accent px-3 py-2">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-medium">
                  {new Date(selectedAppointment.startAt).toLocaleDateString("es-AR", {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-accent px-3 py-2">
                <span className="text-muted-foreground">Hora</span>
                <span className="font-medium">
                  {new Date(selectedAppointment.startAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(selectedAppointment.endAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-accent px-3 py-2">
                <span className="text-muted-foreground">Estado</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    selectedAppointment.status === "CONFIRMED"
                      ? "bg-blue-100 text-blue-700"
                      : selectedAppointment.status === "PENDING"
                        ? "bg-amber-100 text-amber-700"
                        : selectedAppointment.status === "ATTENDED"
                          ? "bg-green-100 text-green-700"
                          : selectedAppointment.status === "ABSENT"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {selectedAppointment.status}
                </span>
              </div>
              {selectedAppointment.reason && (
                <div className="flex flex-col gap-1 rounded-lg bg-accent px-3 py-2">
                  <span className="text-muted-foreground">Motivo</span>
                  <span className="font-medium">{selectedAppointment.reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
