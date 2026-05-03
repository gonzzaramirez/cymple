"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  List,
  LayoutGrid,
} from "lucide-react";
import { ApiList, Appointment, PaymentMethod } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";
import { CenterAppointmentsList } from "./center-appointments-list";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const HOUR_HEIGHT = 64;

const PROFESSIONAL_COLORS = [
  { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd", dot: "#7c3aed" },
  { bg: "#cffafe", text: "#0e7490", border: "#67e8f9", dot: "#0891b2" },
  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d", dot: "#d97706" },
  { bg: "#dcfce7", text: "#166534", border: "#86efac", dot: "#22c55e" },
  { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4", dot: "#ec4899" },
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" }> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  ATTENDED: { label: "Atendido", variant: "success" },
  ABSENT: { label: "Ausente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

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

const STATUS_OPTIONS: { value: Appointment["status"]; label: string }[] = [
  { value: "PENDING", label: "Pendiente" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "ATTENDED", label: "Atendido" },
  { value: "ABSENT", label: "Ausente" },
  { value: "CANCELLED", label: "Cancelado" },
];

type ProfessionalOption = { id: string; fullName?: string | null; email?: string | null };

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

function getHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

function formatHm(date: Date): string {
  return format(date, "HH:mm");
}

function professionalDisplayName(pro: ProfessionalOption): string {
  return pro.fullName?.trim() || pro.email?.trim() || "Sin nombre";
}

function professionalInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).slice(0, 2);
  return tokens.map((t) => t[0]?.toUpperCase() ?? "").join("");
}

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function buildQueryParams(params: URLSearchParams, next: Record<string, string | undefined>) {
  const cloned = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === "") cloned.delete(key);
    else cloned.set(key, value);
  }
  return cloned.toString();
}

type CalendarLayout = "resource" | "compact";
type AgendaMode = "calendar" | "list";

type Props = {
  items: Appointment[];
  listData: ApiList<Appointment> | null;
  professionals: ProfessionalOption[];
  selectedDate: string;
  initialLayout: CalendarLayout;
  initialMode: AgendaMode;
  initialProfessionalIds: string[];
};

export function CenterScheduleCalendar({
  items,
  listData,
  professionals,
  selectedDate,
  initialLayout,
  initialMode,
  initialProfessionalIds,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<AgendaMode>(initialMode);
  const [layout, setLayout] = useState<CalendarLayout>(initialLayout);
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>(initialProfessionalIds);
  const [focusedDate, setFocusedDate] = useState(() => {
    const d = new Date(selectedDate);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [pendingAttended, setPendingAttended] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const d = new Date(selectedDate);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with URL params
    if (!Number.isNaN(d.getTime())) setFocusedDate(d);
  }, [selectedDate]);

  const visibleItems = useMemo(() => items.filter((a) => a.status !== "CANCELLED"), [items]);

  const filteredItems = useMemo(() => {
    if (selectedProfessionals.length === 0) return visibleItems;
    return visibleItems.filter((a) => selectedProfessionals.includes(a.professionalId));
  }, [visibleItems, selectedProfessionals]);

  const dayItems = useMemo(
    () => filteredItems.filter((a) => isSameDay(new Date(a.startAt), focusedDate)),
    [filteredItems, focusedDate],
  );

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    [],
  );

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

  const activeProfessionals = useMemo(() => {
    if (selectedProfessionals.length === 0) return professionals;
    return professionals.filter((p) => selectedProfessionals.includes(p.id));
  }, [selectedProfessionals, professionals]);

  function toggleProfessional(id: string) {
    setSelectedProfessionals((prev) => {
      if (prev.length === 0) return [id];
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function navigateDate(direction: number) {
    const next = direction > 0 ? addDays(focusedDate, 1) : subDays(focusedDate, 1);
    setFocusedDate(next);
    const qs = buildQueryParams(searchParams, { date: next.toISOString(), ui: mode === "list" ? "list" : "calendar", layout, professionalIds: selectedProfessionals.join(",") || undefined });
    router.push(`/center/appointments?${qs}`);
  }

  function goToToday() {
    const today = new Date();
    setFocusedDate(today);
    const qs = buildQueryParams(searchParams, { date: today.toISOString() });
    router.push(`/center/appointments?${qs}`);
  }

  function switchMode(nextMode: AgendaMode) {
    setMode(nextMode);
    const qs = buildQueryParams(searchParams, { ui: nextMode, layout: nextMode === "list" ? "list" : layout, page: nextMode === "list" ? "1" : undefined });
    router.push(`/center/appointments?${qs}`);
  }

  function switchLayout(nextLayout: CalendarLayout) {
    setLayout(nextLayout);
    setMode("calendar");
    const qs = buildQueryParams(searchParams, { ui: "calendar", layout: nextLayout, professionalIds: selectedProfessionals.join(",") || undefined, page: undefined });
    router.push(`/center/appointments?${qs}`);
  }

  function handleAppointmentClick(appointment: Appointment) {
    setSelectedAppointment(appointment);
    setPendingAttended(false);
    setSelectedPayment(null);
  }

  function closeModal() {
    setSelectedAppointment(null);
    setPendingAttended(false);
    setSelectedPayment(null);
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
    if (!res.ok) { sileo.error({ title: "No se pudo actualizar el estado" }); return; }
    sileo.success({ title: "Estado actualizado" });
    closeModal();
    router.refresh();
  }

  function handleActionClick(status: string) {
    if (status === "ATTENDED") { setPendingAttended(true); return; }
    void changeStatus(status);
  }

  function renderAppointmentCard(appointment: Appointment) {
    const color = getProfessionalColor(appointment.professionalId);
    const hasConflict = conflictMap.get(appointment.id) ?? false;
    const patientName = appointment.patient
      ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
      : "Sin paciente";
    const start = new Date(appointment.startAt);
    const end = new Date(appointment.endAt);
    const startHour = getHour(start);
    const endHour = getHour(end);
    const top = (startHour - DAY_START_HOUR) * HOUR_HEIGHT;
    const height = Math.max(24, (endHour - startHour) * HOUR_HEIGHT);

    return (
      <button
        key={appointment.id}
        onClick={() => handleAppointmentClick(appointment)}
        className={cn(
          "absolute left-1 right-1 rounded-lg border px-2 py-1.5 text-left transition-all hover:shadow-md z-10",
          hasConflict && "ring-2 ring-red-400",
        )}
        style={{ top: `${top}px`, height: `${height}px`, backgroundColor: color.bg, borderColor: color.border, color: color.text }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-[13px] truncate">{patientName}</span>
          {hasConflict && (
            <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">!</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] opacity-80">
          <Clock className="size-3" />
          <span>{formatHm(start)} - {formatHm(end)}</span>
        </div>
        {height > 40 && appointment.fee && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] opacity-70">
            <DollarSign className="size-3" />
            <span>{appointment.fee}</span>
          </div>
        )}
      </button>
    );
  }

  function renderResourceView() {
    return (
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex min-w-[900px]">
          {/* Time column */}
          <div className="w-16 shrink-0 border-r border-border bg-muted/50">
            <div className="h-12" />
            {hours.map((hour) => (
              <div key={hour} className="flex items-start justify-end border-t border-border/50 pr-2 pt-1" style={{ height: `${HOUR_HEIGHT}px` }}>
                <span className="text-[11px] font-medium text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* Professional columns */}
          {activeProfessionals.map((prof) => {
            const color = getProfessionalColor(prof.id);
            const profItems = dayItems.filter((a) => a.professionalId === prof.id);
            return (
              <div key={prof.id} className="flex-1 border-r border-border last:border-r-0 min-w-[200px]">
                <div className="h-12 border-b border-border px-3 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: color.dot }}>
                    {professionalInitials(professionalDisplayName(prof))}
                  </span>
                  <span className="text-sm font-semibold truncate">{professionalDisplayName(prof)}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{profItems.length}</span>
                </div>
                <div className="relative" style={{ minHeight: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT}px` }}>
                  {hours.map((hour) => (
                    <div key={hour} className="border-t border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}
                  {profItems.map(renderAppointmentCard)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderCompactView() {
    return (
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex min-w-[700px]">
          {/* Time column */}
          <div className="w-16 shrink-0 border-r border-border bg-muted/50">
            <div className="h-12" />
            {hours.map((hour) => (
              <div key={hour} className="flex items-start justify-end border-t border-border/50 pr-2 pt-1" style={{ height: `${HOUR_HEIGHT}px` }}>
                <span className="text-[11px] font-medium text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* Single day column with all professionals */}
          <div className="flex-1">
            <div className="h-12 border-b border-border px-3 flex items-center">
              <span className="text-sm font-semibold">
                {format(focusedDate, "EEEE d 'de' MMMM", { locale: es })}
                {isToday(focusedDate) && <Badge variant="info" className="ml-2 text-[10px]">Hoy</Badge>}
              </span>
            </div>
            <div className="relative" style={{ minHeight: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT}px` }}>
              {hours.map((hour) => (
                <div key={hour} className="border-t border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
              ))}
              {dayItems.map((a) => {
                const color = getProfessionalColor(a.professionalId);
                const hasConflict = conflictMap.get(a.id) ?? false;
                const patientName = a.patient ? `${a.patient.lastName}, ${a.patient.firstName}` : "Sin paciente";
                const start = new Date(a.startAt);
                const end = new Date(a.endAt);
                const startHour = getHour(start);
                const endHour = getHour(end);
                const top = (startHour - DAY_START_HOUR) * HOUR_HEIGHT;
                const height = Math.max(24, (endHour - startHour) * HOUR_HEIGHT);
                const profName = a.professional?.fullName?.split(" ")[0] ?? "";

                return (
                  <button
                    key={a.id}
                    onClick={() => handleAppointmentClick(a)}
                    className={cn(
                      "absolute left-1 right-1 rounded-lg border px-2 py-1.5 text-left transition-all hover:shadow-md z-10",
                      hasConflict && "ring-2 ring-red-400",
                    )}
                    style={{ top: `${top}px`, height: `${height}px`, backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-[13px] truncate">{patientName}</span>
                      {profName && <span className="shrink-0 text-[10px] font-medium opacity-70">[{profName}]</span>}
                    </div>
                    <div className="mt-0.5 text-[11px] opacity-80">{formatHm(start)} - {formatHm(end)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedCfg = selectedAppointment ? STATUS_CONFIG[selectedAppointment.status] : null;
  const allowedActions = selectedAppointment ? STATUS_ACTIONS[selectedAppointment.status] ?? [] : [];
  const selectedColor = selectedAppointment ? getProfessionalColor(selectedAppointment.professionalId) : null;
  const selectedListProfessionalId = searchParams.get("professionalId") ?? "all";
  const selectedListStatus = searchParams.get("status") ?? "all";

  return (
    <div className="space-y-4">
      {/* Mode + layout switcher */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Vista:</span>
        <button onClick={() => switchLayout("resource")} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", mode === "calendar" && layout === "resource" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground")}>
          <LayoutGrid className="mr-1 inline size-3" />Recursos
        </button>
        <button onClick={() => switchLayout("compact")} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", mode === "calendar" && layout === "compact" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground")}>
          <Calendar className="mr-1 inline size-3" />Compacta
        </button>
        <button onClick={() => switchMode("list")} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", mode === "list" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground")}>
          <List className="mr-1 inline size-3" />Lista
        </button>
      </div>

      {/* Professional filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Profesionales:</span>
        {professionals.map((prof) => {
          const isActive = selectedProfessionals.length === 0 || selectedProfessionals.includes(prof.id);
          const color = getProfessionalColor(prof.id);
          return (
            <button
              key={prof.id}
              onClick={() => toggleProfessional(prof.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all", isActive ? "text-white" : "opacity-60 hover:opacity-80")}
              style={isActive ? { backgroundColor: color.dot } : { backgroundColor: color.bg, color: color.text }}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/85 text-[10px] font-bold text-slate-700">
                {professionalInitials(professionalDisplayName(prof))}
              </span>
              {professionalDisplayName(prof)}
            </button>
          );
        })}
        {selectedProfessionals.length > 0 && (
          <button onClick={() => setSelectedProfessionals([])} className="ml-2 text-xs text-muted-foreground underline hover:text-foreground">
            Mostrar todos
          </button>
        )}
      </div>

      {/* Date navigation (calendar mode) */}
      {mode === "calendar" && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
          <Button variant="ghost" size="icon-sm" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>Hoy</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigateDate(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-2 text-sm font-semibold">
            {format(focusedDate, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>
      )}

      {/* List filters */}
      {mode === "list" && (
        <form method="get" action="/center/appointments" className="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card md:grid-cols-[1.4fr_repeat(4,1fr)_auto] md:items-end">
          <input type="hidden" name="ui" value="list" />
          <input type="hidden" name="layout" value="list" />
          <input type="hidden" name="page" value="1" />
          <div className="space-y-1.5">
            <Label htmlFor="center-appt-search" className="text-xs">Buscar</Label>
            <Input id="center-appt-search" name="search" defaultValue={searchParams.get("search") ?? ""} placeholder="Paciente, DNI, teléfono o email" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select name="status" defaultValue={selectedListStatus}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Profesional</Label>
            <Select name="professionalId" defaultValue={selectedListProfessionalId}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {professionals.map((p) => <SelectItem key={p.id} value={p.id}>{professionalDisplayName(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="center-appt-from" className="text-xs">Desde</Label>
            <Input id="center-appt-from" type="date" name="from" defaultValue={searchParams.get("from") ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="center-appt-to" className="text-xs">Hasta</Label>
            <Input id="center-appt-to" type="date" name="to" defaultValue={searchParams.get("to") ?? ""} />
          </div>
          <Button type="submit">Filtrar</Button>
        </form>
      )}

      {/* Content */}
      {mode === "list" ? (
        listData ? <CenterAppointmentsList data={listData} professionals={professionals} /> : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-10 text-center text-sm text-muted-foreground">
            No se pudo cargar el listado de turnos.
          </div>
        )
      ) : layout === "resource" ? renderResourceView() : renderCompactView()}

      {/* Appointment detail modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated ring-border mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {selectedAppointment.patient ? `${selectedAppointment.patient.lastName}, ${selectedAppointment.patient.firstName}` : "Sin paciente"}
                </h3>
                {selectedAppointment.professional && (
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: selectedColor?.dot }} />
                    {selectedAppointment.professional.fullName}
                  </p>
                )}
              </div>
              {selectedCfg && <Badge variant={selectedCfg.variant}>{selectedCfg.label}</Badge>}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha y hora</p>
                  <p className="font-medium">{format(new Date(selectedAppointment.startAt), "EEE dd/MM HH:mm", { locale: es })} - {formatHm(new Date(selectedAppointment.endAt))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <DollarSign className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Honorario</p>
                  <p className="font-mono font-medium">$ {selectedAppointment.fee}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                {selectedAppointment.modality === "VIRTUAL" ? <Video className="size-4 text-muted-foreground" /> : <MapPin className="size-4 text-muted-foreground" />}
                <div>
                  <p className="text-xs text-muted-foreground">Modalidad</p>
                  <p className="font-medium">{selectedAppointment.modality === "VIRTUAL" ? "Virtual" : "Presencial"}</p>
                </div>
              </div>
              {selectedAppointment.reason && (
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Motivo</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedAppointment.reason}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment selector */}
            {pendingAttended && (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">¿Cómo pagó el paciente?</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSelectedPayment("CASH")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors", selectedPayment === "CASH" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    <Banknote className="size-4" />Efectivo
                  </button>
                  <button type="button" onClick={() => setSelectedPayment("TRANSFER")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors", selectedPayment === "TRANSFER" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    <ArrowLeftRight className="size-4" />Transferencia
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setPendingAttended(false); setSelectedPayment(null); }}>Cancelar</Button>
                  <Button size="sm" className="flex-1 bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20" disabled={!selectedPayment || actionLoading} onClick={() => selectedPayment && void changeStatus("ATTENDED", selectedPayment)}>
                    <CheckCircle2 className="size-4" />{actionLoading ? "Guardando..." : "Confirmar asistencia"}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            {!pendingAttended && allowedActions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Acciones</p>
                <div className="flex flex-wrap gap-2">
                  {allowedActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button key={action.status} variant="ghost" size="sm" className={cn(
                        action.status === "CONFIRMED" && "bg-primary/10 text-primary hover:bg-primary/20",
                        action.status === "ATTENDED" && "bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20",
                        action.status === "ABSENT" && "bg-[#ff9500]/10 text-[#c77700] hover:bg-[#ff9500]/20",
                        action.status === "CANCELLED" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                      )} onClick={() => handleActionClick(action.status)}>
                        <Icon className="size-4" />{action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="ghost" size="sm" className="w-full mt-4" onClick={closeModal}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
