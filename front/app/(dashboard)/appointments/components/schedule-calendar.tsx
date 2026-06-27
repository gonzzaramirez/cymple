"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, addDays, subDays, startOfWeek, isToday, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Video,
  Banknote,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { Appointment, PaymentMethod } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";
import { ClinicalRichTextEditor } from "@/components/clinical/clinical-rich-text-editor";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const HOUR_HEIGHT = 52; // px per hour — enough room for name + time in 30min slots

const PROFESSIONAL_COLORS = [
  { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd", dot: "#7c3aed" }, // Purple
  { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd", dot: "#3b82f6" }, // Blue
  { bg: "#cffafe", text: "#0e7490", border: "#67e8f9", dot: "#0891b2" }, // Cyan
  { bg: "#ccfbf1", text: "#0f766e", border: "#5eead4", dot: "#14b8a6" }, // Teal
  { bg: "#dcfce7", text: "#166534", border: "#86efac", dot: "#22c55e" }, // Green
  { bg: "#fef9c3", text: "#854d0e", border: "#fde047", dot: "#ca8a04" }, // Lime
  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d", dot: "#d97706" }, // Amber
  { bg: "#ffedd5", text: "#9a3412", border: "#fdba74", dot: "#f97316" }, // Orange
  { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5", dot: "#ef4444" }, // Red
  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4", dot: "#ec4899" }, // Pink
  { bg: "#fae8ff", text: "#86198f", border: "#e9d5ff", dot: "#a855f7" }, // Fuchsia
  { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1", dot: "#64748b" }, // Slate
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" }> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  ATTENDED: { label: "Atendido", variant: "success" },
  ABSENT: { label: "Ausente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#fef3c7", text: "#92400e" },
  CONFIRMED: { bg: "#dbeafe", text: "#1e40af" },
  ATTENDED: { bg: "#dcfce7", text: "#166534" },
  ABSENT: { bg: "#ffedd5", text: "#9a3412" },
  CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
};

function getStatusColor(status: string): { bg: string; text: string } {
  return STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#475569" };
}

const STATUS_ACTIONS: Record<string, { status: string; label: string; icon: typeof CheckCircle2 }[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirmar", icon: CheckCircle2 },
    { status: "CANCELLED", label: "Cancelar", icon: XCircle },
  ],
  CONFIRMED: [
    { status: "ATTENDED", label: "Atendido", icon: CheckCircle2 },
    { status: "ABSENT", label: "Ausente", icon: AlertCircle },
    { status: "CANCELLED", label: "Cancelar", icon: XCircle },
  ],
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getProfessionalColor(professionalId: string) {
  return PROFESSIONAL_COLORS[hashString(professionalId) % PROFESSIONAL_COLORS.length];
}

function useClinicalReason(selectedAppointment: Appointment | null) {
  const [reasonInitialContent, setReasonInitialContent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!selectedAppointment) return;
    const controller = new AbortController();
    const loadReason = async () => {
      const response = await fetch(
        `/api/backend/patients/${selectedAppointment.patientId}/clinical-records?recordType=APPOINTMENT_REASON&limit=200`,
        { signal: controller.signal }
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        items?: Array<{ appointmentId?: string | null; content?: Record<string, unknown> }>;
      };
      const reasonRecord = payload.items?.find(
        (item) => item.appointmentId === selectedAppointment.id,
      );
      if (reasonRecord?.content) {
        setReasonInitialContent(reasonRecord.content);
      }
    };
    void loadReason();
    return () => controller.abort();
  }, [selectedAppointment]);

  return { reasonInitialContent, setReasonInitialContent };
}

function getHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

function formatHm(date: Date): string {
  return format(date, "HH:mm");
}

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => addDays(start, i)); // Mon-Fri only
}

type LayoutSlot = {
  left: string;
  width: string;
  totalColumns: number;
  column: number;
};

function computeHorizontalLayout(items: Appointment[]): Map<string, LayoutSlot> {
  if (items.length === 0) return new Map();

  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  // Group overlapping appointments via DFS (transitive overlap)
  const groups: Appointment[][] = [];
  const visited = new Set<string>();

  for (const appt of sorted) {
    if (visited.has(appt.id)) continue;
    const group: Appointment[] = [];
    const queue = [appt];
    visited.add(appt.id);

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      const current = item;
      group.push(current);
      for (const other of sorted) {
        if (visited.has(other.id)) continue;
        const cStart = new Date(current.startAt).getTime();
        const cEnd = new Date(current.endAt).getTime();
        const oStart = new Date(other.startAt).getTime();
        const oEnd = new Date(other.endAt).getTime();
        if (cStart < oEnd && oStart < cEnd) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }

    group.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    groups.push(group);
  }

  // Assign lanes per group (first-fit)
  const result = new Map<string, LayoutSlot>();

  for (const group of groups) {
    const lanes: { end: number }[] = [];
    const laneMap = new Map<string, number>();

    for (const appt of group) {
      const start = new Date(appt.startAt).getTime();
      const end = new Date(appt.endAt).getTime();

      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i].end <= start) {
          lanes[i].end = end;
          laneMap.set(appt.id, i);
          placed = true;
          break;
        }
      }

      if (!placed) {
        laneMap.set(appt.id, lanes.length);
        lanes.push({ end });
      }
    }

    const totalColumns = lanes.length;
    for (const appt of group) {
      const col = laneMap.get(appt.id)!;
      result.set(appt.id, {
        left: `${(col / totalColumns) * 100}%`,
        width: `${(1 / totalColumns) * 100}%`,
        totalColumns,
        column: col,
      });
    }
  }

  return result;
}

type ScheduleCalendarProps = {
  items: Appointment[];
  selectedDate: string;
};

export function ScheduleCalendar({ items, selectedDate }: ScheduleCalendarProps) {
  const router = useRouter();
  const [focusedDate, setFocusedDate] = useState(() => {
    const d = new Date(selectedDate);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  });
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [pendingAttended, setPendingAttended] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { reasonInitialContent, setReasonInitialContent } = useClinicalReason(selectedAppointment);

  useEffect(() => {
    const d = new Date(selectedDate);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with URL params
    if (!Number.isNaN(d.getTime())) setFocusedDate(d);
  }, [selectedDate]);

  const visibleItems = useMemo(() => {
    return items.filter((a) => {
      if (selectedProfessional !== "all" && a.professionalId !== selectedProfessional) return false;
      return true;
    });
  }, [items, selectedProfessional]);

  const hasProfessional = useMemo(
    () => visibleItems.some((a) => a.professional),
    [visibleItems],
  );

  const professionals = useMemo(() => {
    if (!hasProfessional) return [];
    const map = new Map<string, { id: string; fullName: string }>();
    for (const a of visibleItems) {
      if (a.professional && !map.has(a.professional.id)) {
        map.set(a.professional.id, { id: a.professional.id, fullName: a.professional.fullName });
      }
    }
    return [...map.values()];
  }, [visibleItems, hasProfessional]);

  const weekDays = useMemo(() => {
    return getWeekDays(focusedDate); // Always Mon-Fri
  }, [focusedDate]);

  const dayItems = useMemo(() => {
    if (view === "week") {
      const weekStart = weekDays[0];
      const weekEnd = addDays(weekDays[weekDays.length - 1], 1);
      return visibleItems.filter((a) => {
        const d = new Date(a.startAt);
        return d >= weekStart && d < weekEnd;
      });
    }
    return visibleItems.filter((a) => isSameDay(new Date(a.startAt), focusedDate));
  }, [visibleItems, focusedDate, view, weekDays]);

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    [],
  );

  function navigateDate(direction: number) {
    const days = view === "week" ? 7 : 1;
    const next = direction > 0 ? addDays(focusedDate, days) : subDays(focusedDate, days);
    setFocusedDate(next);
    router.push(`/appointments?date=${next.toISOString()}&ui=calendar`);
  }

  function goToToday() {
    const today = new Date();
    setFocusedDate(today);
    router.push(`/appointments?date=${today.toISOString()}&ui=calendar`);
  }

  function handleAppointmentClick(appointment: Appointment) {
    setSelectedAppointment(appointment);
    setPendingAttended(false);
    setSelectedPayment(null);
    setReasonInitialContent(null);
  }

  function closeModal() {
    setSelectedAppointment(null);
    setPendingAttended(false);
    setSelectedPayment(null);
    setReasonInitialContent(null);
  }

  async function changeStatus(status: string, paymentMethod?: PaymentMethod) {
    if (!selectedAppointment) return;
    setActionLoading(true);
    const body: Record<string, unknown> = { status };
    if (paymentMethod) body.paymentMethod = paymentMethod;

    const res = await fetch(`/api/backend/appointments/${selectedAppointment.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActionLoading(false);

    if (!res.ok) {
      sileo.error({ title: "No se pudo actualizar el estado" });
      return;
    }

    sileo.success({ title: "Estado actualizado" });
    closeModal();
    router.refresh();
  }

  function handleActionClick(status: string) {
    if (status === "ATTENDED") {
      setPendingAttended(true);
      return;
    }
    void changeStatus(status);
  }

  // Detect conflicts (overlapping appointments per professional)
  const conflictMap = useMemo(() => {
    const conflicts = new Map<string, boolean>();
    const byProf = new Map<string, Appointment[]>();
    for (const a of dayItems) {
      const list = byProf.get(a.professionalId) ?? [];
      list.push(a);
      byProf.set(a.professionalId, list);
    }
    for (const [, appointments] of byProf) {
      const sorted = [...appointments].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const aEnd = new Date(sorted[i].endAt).getTime();
          const bStart = new Date(sorted[j].startAt).getTime();
          if (bStart < aEnd) {
            conflicts.set(sorted[i].id, true);
            conflicts.set(sorted[j].id, true);
          } else break;
        }
      }
    }
    return conflicts;
  }, [dayItems]);

  function renderAppointmentCard(
    appointment: Appointment,
    layout?: LayoutSlot,
  ) {
    const statusColor = getStatusColor(appointment.status);
    const profColor = hasProfessional && appointment.professional
      ? getProfessionalColor(appointment.professional.id)
      : null;
    const hasConflict = conflictMap.get(appointment.id) ?? false;
    const isCancelled = appointment.status === "CANCELLED";
    const patientName = appointment.patient
      ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
      : "Sin paciente";
    const start = new Date(appointment.startAt);
    const end = new Date(appointment.endAt);
    const startHour = getHour(start);
    const endHour = getHour(end);
    const top = (startHour - DAY_START_HOUR) * HOUR_HEIGHT;
    const rawHeight = (endHour - startHour) * HOUR_HEIGHT;
    const height = Math.max(28, rawHeight);
    const durationMin = Math.round((endHour - startHour) * 60);

    const cols = layout?.totalColumns ?? 1;
    const multiColumn = cols > 1;

    const baseSize = cols >= 4 ? 9 : cols >= 3 ? 10 : 11;
    const nameSize = height < 34 ? `${baseSize - 1}` : `${baseSize}`;
    const detailSize = height < 34 ? `${baseSize - 1}` : `${baseSize - 1}`;
    const padY = height < 34 ? "py-0.5" : height < 44 ? "py-1" : "py-1.5";

    const showTime = true;
    const showFee = height >= 44 && appointment.fee && !multiColumn;

    return (
      <button
        key={appointment.id}
        onClick={() => handleAppointmentClick(appointment)}
        className={cn(
          "absolute rounded-md border-l-[3px] text-left transition-colors hover:shadow-md z-10",
          `px-1 ${padY}`,
          isCancelled && "opacity-60",
          hasConflict && "ring-2 ring-red-400",
        )}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: multiColumn ? `calc(${layout!.left} + 1px)` : "0.25rem",
          width: multiColumn ? `calc(${layout!.width} - 2px)` : "calc(100% - 0.5rem)",
          backgroundColor: statusColor.bg,
          borderColor: profColor?.dot ?? "#cbd5e1",
        }}
      >
        <span
          className={cn("font-semibold truncate block leading-tight", isCancelled && "line-through")}
          style={{ color: statusColor.text, fontSize: `${nameSize}px` }}
        >
          {patientName}
        </span>

        {showTime && (
          <div
            className="flex items-center gap-1 leading-tight mt-px"
            style={{ color: statusColor.text, fontSize: `${detailSize}px`, opacity: 0.75 }}
          >
            <Clock className="shrink-0" style={{ width: `${detailSize}px`, height: `${detailSize}px` }} />
            <span className="truncate tabular-nums">{formatHm(start)}</span>
            <span className="opacity-50">-</span>
            <span className="tabular-nums">{formatHm(end)}</span>
            <span className="opacity-50">· {durationMin}m</span>
          </div>
        )}

        {showFee && (
          <div
            className="flex items-center gap-1 leading-tight"
            style={{ color: statusColor.text, fontSize: `${detailSize}px`, opacity: 0.65 }}
          >
            <DollarSign className="shrink-0" style={{ width: `${detailSize}px`, height: `${detailSize}px` }} />
            <span>${appointment.fee}</span>
          </div>
        )}

        {hasConflict && (
          <span className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-red-100 text-[8px] font-bold text-red-700 leading-none">
            !
          </span>
        )}
      </button>
    );
  }

  function renderDayColumn(date: Date, appointments: Appointment[], profId?: string) {
    const dayAppointments = profId
      ? appointments.filter((a) => a.professionalId === profId && isSameDay(new Date(a.startAt), date))
      : appointments.filter((a) => isSameDay(new Date(a.startAt), date));

    const layout = computeHorizontalLayout(dayAppointments);

    return (
      <div className="relative" style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT}px` }}>
        {hours.map((hour) => (
          <div
            key={hour}
            className="border-t border-border/50"
            style={{ height: `${HOUR_HEIGHT}px` }}
          />
        ))}
        {dayAppointments.map((a) => renderAppointmentCard(a, layout.get(a.id)))}
      </div>
    );
  }

  const selectedCfg = selectedAppointment ? STATUS_CONFIG[selectedAppointment.status] : null;
  const allowedActions = selectedAppointment ? STATUS_ACTIONS[selectedAppointment.status] ?? [] : [];
  const selectedColor = selectedAppointment && hasProfessional && selectedAppointment.professional
    ? getProfessionalColor(selectedAppointment.professional.id)
    : null;

  return (
    <div className="space-y-2">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="ghost" size="xs" onClick={goToToday}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigateDate(1)}>
            <ChevronRight className="size-3.5" />
          </Button>
          <h2 className="ml-1 text-xs font-semibold">
            {view === "day"
              ? format(focusedDate, "EEEE d 'de' MMMM", { locale: es })
              : `${format(weekDays[0], "d MMM", { locale: es })} - ${format(weekDays[weekDays.length - 1], "d MMM yyyy", { locale: es })}`}
          </h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => setView("day")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              view === "day" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Calendar className="mr-1 inline size-2.5" />
            Día
          </button>
          <button
            onClick={() => setView("week")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              view === "week" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Professional filter */}
      {hasProfessional && professionals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 shadow-card">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Profesional:</span>
          <button
            onClick={() => setSelectedProfessional("all")}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
              selectedProfessional === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Todos
          </button>
          {professionals.map((prof) => {
            const color = getProfessionalColor(prof.id);
            const isActive = selectedProfessional === prof.id;
            return (
              <button
                key={prof.id}
                onClick={() => setSelectedProfessional(isActive ? "all" : prof.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                  isActive ? "text-white" : "opacity-70 hover:opacity-100",
                )}
                style={
                  isActive
                    ? { backgroundColor: color.dot }
                    : { backgroundColor: color.bg, color: color.text }
                }
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: isActive ? "#fff" : color.dot }} />
                {prof.fullName}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        {view === "day" ? (
          <div className="flex min-w-[600px]">
            {/* Time column */}
            <div className="w-16 shrink-0 border-r border-border bg-muted/50">
              <div className="h-10" /> {/* header spacer */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start justify-end border-t border-border/50 pr-1.5 pt-0.5"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Appointments column */}
            <div className="flex-1">
              <div className="h-8 border-b border-border px-2 flex items-center">
                <span className="text-xs font-semibold">
                  {format(focusedDate, "EEEE d", { locale: es })}
                  {isToday(focusedDate) && (
                    <Badge variant="info" className="ml-1.5 text-[9px] py-px">Hoy</Badge>
                  )}
                </span>
              </div>
              {renderDayColumn(focusedDate, dayItems)}
            </div>
          </div>
        ) : (
          <div className="flex min-w-[900px]">
            {/* Time column */}
            <div className="w-14 shrink-0 border-r border-border bg-muted/50">
              <div className="h-8" />
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start justify-end border-t border-border/50 pr-1.5 pt-0.5"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => (
              <div key={day.toISOString()} className="flex-1 border-r border-border last:border-r-0">
                <div className="h-8 border-b border-border px-1 flex items-center justify-center">
                  <span className={cn(
                    "text-[11px] font-semibold",
                    isToday(day) && "text-primary",
                  )}>
                    {format(day, "EEE d", { locale: es })}
                    {isToday(day) && (
                      <span className="ml-1 inline-block size-1.5 rounded-full bg-primary" />
                    )}
                  </span>
                </div>
                {renderDayColumn(day, dayItems)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment detail modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-2xl bg-card p-4 sm:p-6 shadow-elevated ring-border max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 sm:mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-semibold truncate">
                  {selectedAppointment.patient
                    ? `${selectedAppointment.patient.lastName}, ${selectedAppointment.patient.firstName}`
                    : "Sin paciente"}
                </h3>
                {selectedAppointment.professional && (
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: selectedColor?.dot }}
                    />
                    <span className="truncate">{selectedAppointment.professional.fullName}</span>
                  </p>
                )}
              </div>
              <div className="shrink-0">{selectedCfg && <Badge variant={selectedCfg.variant}>{selectedCfg.label}</Badge>}</div>
            </div>

            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-muted/50 px-2.5 sm:px-3 py-2 sm:py-2.5">
                <Clock className="size-3.5 sm:size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Fecha y hora</p>
                  <p className="font-medium truncate">
                    {format(new Date(selectedAppointment.startAt), "EEE dd/MM HH:mm", { locale: es })} - {formatHm(new Date(selectedAppointment.endAt))}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-muted/50 px-2.5 sm:px-3 py-2 sm:py-2.5">
                <DollarSign className="size-3.5 sm:size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Honorario</p>
                  <p className="font-mono font-medium">$ {selectedAppointment.fee}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-muted/50 px-2.5 sm:px-3 py-2 sm:py-2.5">
                {selectedAppointment.modality === "VIRTUAL" ? (
                  <Video className="size-3.5 sm:size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <MapPin className="size-3.5 sm:size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Modalidad</p>
                  <p className="font-medium">{selectedAppointment.modality === "VIRTUAL" ? "Virtual" : "Presencial"}</p>
                </div>
              </div>
              {selectedAppointment.reason && (
                <div className="flex items-start gap-2 sm:gap-3 rounded-lg bg-muted/50 px-2.5 sm:px-3 py-2 sm:py-2.5">
                  <FileText className="mt-0.5 size-3.5 sm:size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs text-muted-foreground">Motivo</p>
                    <p className="font-medium whitespace-pre-wrap text-xs sm:text-sm">{selectedAppointment.reason}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 sm:mt-4">
              <div className="mb-1.5 sm:mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Motivo de turno (historial clínico)
                </p>
                {selectedAppointment.patientId && (
                  <Link
                    href={`/patients/${selectedAppointment.patientId}`}
                    className="text-[11px] sm:text-xs text-primary hover:underline shrink-0"
                  >
                    Ver historial
                  </Link>
                )}
              </div>
              <ClinicalRichTextEditor
                initialContent={reasonInitialContent}
                placeholder="Motivo de consulta, evolución y plan..."
                templates={[
                  {
                    id: "soap",
                    label: "Plantilla SOAP",
                    content: {
                      type: "doc",
                      content: [
                        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "SOAP" }] },
                        { type: "paragraph", content: [{ type: "text", text: "S: " }] },
                        { type: "paragraph", content: [{ type: "text", text: "O: " }] },
                        { type: "paragraph", content: [{ type: "text", text: "A: " }] },
                        { type: "paragraph", content: [{ type: "text", text: "P: " }] },
                      ],
                    },
                  },
                ]}
                onSave={async (payload) => {
                  if (!selectedAppointment) return;
                  const response = await fetch(
                    `/api/backend/appointments/${selectedAppointment.id}/reason`,
                    {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    },
                  );
                  if (!response.ok) {
                    sileo.error({ title: "No se pudo guardar el motivo del turno" });
                    throw new Error("save failed");
                  }
                  router.refresh();
                }}
              />
            </div>

            {/* Payment selector for ATTENDED */}
            {pendingAttended && (
              <div className="mt-3 sm:mt-4 rounded-xl border border-border bg-muted/30 p-3 sm:p-4 space-y-2 sm:space-y-3">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  ¿Cómo pagó el paciente?
                </p>
                <div className="flex gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment("CASH")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors",
                      selectedPayment === "CASH"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <Banknote className="size-3.5 sm:size-4" />
                    Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayment("TRANSFER")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors",
                      selectedPayment === "TRANSFER"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <ArrowLeftRight className="size-3.5 sm:size-4" />
                    Transferencia
                  </button>
                </div>
                <div className="flex gap-2 pt-0.5 sm:pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() => { setPendingAttended(false); setSelectedPayment(null); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20 text-xs sm:text-sm"
                    disabled={!selectedPayment || actionLoading}
                    onClick={() => selectedPayment && void changeStatus("ATTENDED", selectedPayment)}
                  >
                    <CheckCircle2 className="size-3.5 sm:size-4" />
                    {actionLoading ? "Guardando..." : "Confirmar asistencia"}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            {!pendingAttended && allowedActions.length > 0 && (
              <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Acciones
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {allowedActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.status}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "text-xs sm:text-sm",
                          action.status === "CONFIRMED" && "bg-primary/10 text-primary hover:bg-primary/20",
                          action.status === "ATTENDED" && "bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20",
                          action.status === "ABSENT" && "bg-[#ff9500]/10 text-[#c77700] hover:bg-[#ff9500]/20",
                          action.status === "CANCELLED" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                        )}
                        onClick={() => handleActionClick(action.status)}
                      >
                        <Icon className="size-3.5 sm:size-4" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="ghost" size="sm" className="w-full mt-3 sm:mt-4 text-xs sm:text-sm" onClick={closeModal}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
