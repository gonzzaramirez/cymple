"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "temporal-polyfill/global";
import {
  createViewWeek,
  createViewDay,
  createViewMonthAgenda,
  type CalendarEvent,
} from "@schedule-x/calendar";
import { useNextCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createEventModalPlugin } from "@schedule-x/event-modal";
import { createCurrentTimePlugin } from "@schedule-x/current-time";
import { Appointment as AppointmentType } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppointmentEventModal } from "./appointment-event-modal";

/** Claves en minúsculas: deben coincidir con calendarId del evento (status en minúsculas). */
const STATUS_CALENDARS = {
  pending: {
    colorName: "pending",
    lightColors: {
      main: "#ff9500",
      container: "#fff3e0",
      onContainer: "#c77700",
    },
    darkColors: {
      main: "#ffb340",
      container: "#3d2e00",
      onContainer: "#ffd080",
    },
  },
  confirmed: {
    colorName: "confirmed",
    lightColors: {
      main: "#3b82f6",
      container: "#bfdbfe",
      onContainer: "#1d4ed8",
    },
    darkColors: {
      main: "#60a5fa",
      container: "#1e3a5f",
      onContainer: "#bfdbfe",
    },
  },
  attended: {
    colorName: "attended",
    lightColors: {
      main: "#34c759",
      container: "#e8f9ed",
      onContainer: "#248a3d",
    },
    darkColors: {
      main: "#30d158",
      container: "#003d15",
      onContainer: "#80f0a0",
    },
  },
  absent: {
    colorName: "absent",
    lightColors: {
      main: "#ff3b30",
      container: "#ffe5e3",
      onContainer: "#d70015",
    },
    darkColors: {
      main: "#ff453a",
      container: "#5a0008",
      onContainer: "#ff9090",
    },
  },
  cancelled: {
    colorName: "cancelled",
    lightColors: {
      main: "#8e8e93",
      container: "#f2f3f5",
      onContainer: "#45515e",
    },
    darkColors: {
      main: "#a1a1aa",
      container: "#27272a",
      onContainer: "#d4d4d8",
    },
  },
};

const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Formatea una fecha JS en la zona horaria de Buenos Aires como "YYYY-MM-DD HH:mm". */
function formatDateTimeFallback(date: Date): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // sv-SE produce "YYYY-MM-DD HH:MM" directamente
  return formatter.format(date).slice(0, 16);
}

function toCalendarDateValue(date: Date): CalendarEvent["start"] {
  const T = globalThis.Temporal;
  if (!T?.Instant?.fromEpochMilliseconds) {
    return formatDateTimeFallback(date) as unknown as CalendarEvent["start"];
  }

  const instant = T.Instant.fromEpochMilliseconds(date.getTime());
  return instant.toZonedDateTimeISO(TIMEZONE) as unknown as CalendarEvent["start"];
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function appointmentsToEvents(items: AppointmentType[]): CalendarEvent[] {
  return items
    .filter((a) => a.status !== "CANCELLED")
    .map((a) => ({
      id: safeId(a.id),
      title: a.patient
        ? `${a.patient.lastName}, ${a.patient.firstName}`
        : "Sin paciente",
      start: toCalendarDateValue(new Date(a.startAt)),
      end: toCalendarDateValue(new Date(a.endAt)),
      calendarId: a.status.toLowerCase(),
      _options: { disableDND: true, disableResize: true },
      appointment: a,
    }));
}

type ScheduleCalendarProps = {
  items: AppointmentType[];
  /** ISO date string recibido del servidor para anclar la vista inicial. */
  selectedDate: string;
  hideWeekends: boolean;
};

function isWeekendInBuenosAires(dateInput: string | Date): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);
  return weekday === "Sat" || weekday === "Sun";
}

export function ScheduleCalendar({ items, selectedDate, hideWeekends }: ScheduleCalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  // Refs para que los callbacks del calendario siempre accedan a los valores más recientes
  const searchParamsRef = useRef(searchParams);
  const routerRef = useRef(router);

  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const visibleItems = useMemo(() => {
    if (!hideWeekends) return items;
    return items.filter((item) => !isWeekendInBuenosAires(item.startAt));
  }, [items, hideWeekends]);

  const events = useMemo(() => appointmentsToEvents(visibleItems), [visibleItems]);
  const eventModal = useMemo(() => createEventModalPlugin(), []);
  const currentTime = useMemo(() => createCurrentTimePlugin(), []);
  const queryView = searchParams.get("view");
  const resolvedView = queryView === "day" || queryView === "month" || queryView === "week"
    ? queryView
    : isMobile
      ? "day"
      : "week";

  // Convierte el string ISO del servidor a Temporal.PlainDate para anclar la vista inicial
  const selectedPlainDate = useMemo(() => {
    const T = globalThis.Temporal;
    if (!T?.PlainDate?.from) return undefined;
    try {
      return T.PlainDate.from(selectedDate.split("T")[0]);
    } catch {
      return undefined;
    }
  }, [selectedDate]);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (queryView) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", resolvedView);
    params.set("ui", "calendar");
    router.replace(`/appointments?${params.toString()}`);
  }, [queryView, resolvedView, router, searchParams]);

  const calendarApp = useNextCalendarApp(
    {
      views: [createViewWeek(), createViewDay(), createViewMonthAgenda()],
      defaultView: resolvedView,
      // Ancla la vista inicial a la semana/día que el servidor fetcheó
      ...(selectedPlainDate ? { selectedDate: selectedPlainDate } : {}),
      locale: "es-AR",
      timezone: TIMEZONE,
      firstDayOfWeek: 1,
      dayBoundaries: {
        start: "07:00",
        end: "21:00",
      },
      weekOptions: {
        gridHeight: isMobile ? 520 : 620,
        nDays: hideWeekends ? 5 : 7,
        eventWidth: isMobile ? 98 : 96,
        gridStep: 30,
      },
      calendars: STATUS_CALENDARS,
      events,
      skipValidation: true,
      callbacks: {
        onEventClick: (event: CalendarEvent) => {
          const appt = (event as unknown as { appointment: AppointmentType })
            .appointment;
          if (appt) {
            setSelectedAppointment(appt);
            setModalOpen(true);
          }
        },
        onClickDateTime: () => {
          setModalOpen(false);
        },
        onRangeUpdate: (range) => {
          // Cuando el usuario navega a otra semana/día/mes, refetcheamos desde el servidor
          const epochMs = range.start.toInstant().epochMilliseconds;
          let targetDate = new Date(epochMs);
          if (hideWeekends) {
            const safetyWindowMs = 14 * 24 * 60 * 60 * 1000;
            let elapsed = 0;
            while (isWeekendInBuenosAires(targetDate) && elapsed < safetyWindowMs) {
              targetDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
              elapsed += 24 * 60 * 60 * 1000;
            }
          }
          const dateParam = targetDate.toISOString();
          const params = new URLSearchParams(searchParamsRef.current.toString());
          params.set("date", dateParam);
          params.set("ui", "calendar");
          params.set("view", resolvedView);
          routerRef.current.push(`/appointments?${params.toString()}`);
        },
      },
      translations: {
        "es-AR": {
          Today: "Hoy",
          today: "Hoy",
          Week: "Semana",
          week: "Semana",
          Day: "Día",
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
    },
    // Solo plugins reales (isMobile era un bug: se pasaba como plugin incorrecto)
    [eventModal, currentTime]
  );

  useEffect(() => {
    if (calendarApp) {
      calendarApp.events.set(appointmentsToEvents(visibleItems));
    }
  }, [visibleItems, calendarApp]);

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleActionSuccess = () => {
    handleModalClose();
    router.refresh();
  };

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-card shadow-card ring-border">
        <div className="sx-calendar-wrapper" data-mobile={isMobile ? "true" : "false"}>
          {calendarApp && <ScheduleXCalendar calendarApp={calendarApp} />}
        </div>
      </div>

      {modalOpen && selectedAppointment && (
        <AppointmentEventModal
          appointment={selectedAppointment}
          open={modalOpen}
          onClose={handleModalClose}
          onActionSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}
