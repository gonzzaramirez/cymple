"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sileo } from "sileo";
import {
  Plus,
  Trash2,
  Clock,
  CalendarDays,
  Save,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const WEEKDAY_LABELS: Record<string, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

const ALL_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

type Range = { startTime: string; endTime: string; capacity: number | null };
type SlotCapacity = { startTime: string; capacity: number };

type DayConfig = {
  weekday: string;
  enabled: boolean;
  ranges: Range[];
  expanded: boolean;
};

type SpecificDateConfig = {
  date: string;
  enabled: boolean;
  ranges: Range[];
  slotCapacities: SlotCapacity[];
  expanded: boolean;
};

type WeeklyDay = {
  id: string;
  weekday: string;
  isEnabled: boolean;
  ranges: { startTime: string; endTime: string; capacity?: number | null }[];
};

type SpecificDate = {
  id: string;
  date: string;
  isEnabled: boolean;
  ranges: { startTime: string; endTime: string; capacity?: number | null }[];
  slotCapacities?: { startTime: string; capacity: number }[];
};

function buildInitialDays(weekly: WeeklyDay[]): DayConfig[] {
  const map = new Map(weekly.map((w) => [w.weekday, w]));
  return ALL_DAYS.map((weekday) => {
    const existing = map.get(weekday);
    const hasRanges = (existing?.ranges?.length ?? 0) > 0;
    return {
      weekday,
      enabled: existing?.isEnabled ?? false,
      ranges: hasRanges && existing
        ? existing.ranges.map((r) => ({
            startTime: r.startTime,
            endTime: r.endTime,
            capacity: r.capacity ?? null,
          }))
        : [],
      expanded: existing?.isEnabled ?? false,
    };
  });
}

function formatDateISO(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10);
  } catch {
    return dateStr.slice(0, 10);
  }
}

type AvailabilityConfigProps = {
  weekly: WeeklyDay[];
  specificDates: SpecificDate[];
  professionalId?: string;
};

export function AvailabilityConfig({
  weekly,
  specificDates,
  professionalId,
}: AvailabilityConfigProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [days, setDays] = useState<DayConfig[]>(() => buildInitialDays(weekly));
  const [specDates, setSpecDates] = useState<SpecificDateConfig[]>(() =>
    specificDates.map((sd) => ({
      date: formatDateISO(sd.date),
      enabled: sd.isEnabled,
      ranges: sd.ranges.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        capacity: r.capacity ?? null,
      })),
      slotCapacities: sd.slotCapacities ?? [],
      expanded: true,
    }))
  );
  const [newDate, setNewDate] = useState("");
  const [newDateRanges, setNewDateRanges] = useState<Range[]>([
    { startTime: "09:00", endTime: "13:00", capacity: null },
  ]);

  function toggleDay(weekday: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const newEnabled = !d.enabled;
        return {
          ...d,
          enabled: newEnabled,
          expanded: newEnabled,
          ranges: newEnabled && d.ranges.length === 0
            ? [{ startTime: "09:00", endTime: "13:00", capacity: null }]
            : d.ranges,
        };
      })
    );
  }

  function toggleExpand(weekday: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday ? { ...d, expanded: !d.expanded } : d
      )
    );
  }

  function addRange(weekday: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, ranges: [...d.ranges, { startTime: "16:00", endTime: "20:00", capacity: null }] }
          : d
      )
    );
  }

  function removeRange(weekday: string, index: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, ranges: d.ranges.filter((_, i) => i !== index) }
          : d
      )
    );
  }

  function updateRange(
    weekday: string,
    index: number,
    field: "startTime" | "endTime" | "capacity",
    value: string,
  ) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? {
              ...d,
              ranges: d.ranges.map((r, i) =>
                i === index
                  ? {
                      ...r,
                      [field]:
                        field === "capacity"
                          ? value === ""
                            ? null
                            : Number(value)
                          : value,
                    }
                  : r,
              ),
            }
          : d
      )
    );
  }

  function toggleSpecDate(date: string) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date ? { ...sd, enabled: !sd.enabled } : sd
      )
    );
  }

  function toggleSpecExpand(date: string) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date ? { ...sd, expanded: !sd.expanded } : sd
      )
    );
  }

  function addSpecDateRange(date: string) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date
          ? { ...sd, ranges: [...sd.ranges, { startTime: "16:00", endTime: "20:00", capacity: null }] }
          : sd
      )
    );
  }

  function removeSpecDateRange(date: string, index: number) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date
          ? { ...sd, ranges: sd.ranges.filter((_, i) => i !== index) }
          : sd
      )
    );
  }

  function updateSpecDateRange(
    date: string,
    index: number,
    field: "startTime" | "endTime" | "capacity",
    value: string,
  ) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date
          ? {
              ...sd,
              ranges: sd.ranges.map((r, i) =>
                i === index
                  ? {
                      ...r,
                      [field]:
                        field === "capacity"
                          ? value === ""
                            ? null
                            : Number(value)
                          : value,
                    }
                  : r,
              ),
            }
          : sd
      )
    );
  }

  function addNewSpecDate() {
    if (!newDate) return;
    const exists = specDates.some((sd) => sd.date === newDate);
    if (exists) {
      sileo.error({ title: "Esa fecha ya fue agregada" });
      return;
    }
    setSpecDates((prev) => [
      ...prev,
      {
        date: newDate,
        enabled: true,
        ranges: newDateRanges,
        slotCapacities: [],
        expanded: true,
      },
    ]);
    setNewDate("");
    setNewDateRanges([{ startTime: "09:00", endTime: "13:00", capacity: null }]);
  }

  function removeSpecDate(date: string) {
    setSpecDates((prev) => prev.filter((sd) => sd.date !== date));
  }

  function addSlotCapacity(date: string) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date
          ? {
              ...sd,
              slotCapacities: [
                ...sd.slotCapacities,
                { startTime: "09:00", capacity: 1 },
              ],
            }
          : sd,
      ),
    );
  }

  function removeSlotCapacity(date: string, index: number) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date
          ? {
              ...sd,
              slotCapacities: sd.slotCapacities.filter((_, i) => i !== index),
            }
          : sd,
      ),
    );
  }

  function updateSlotCapacity(
    date: string,
    index: number,
    field: "startTime" | "capacity",
    value: string,
  ) {
    setSpecDates((prev) =>
      prev.map((sd) =>
        sd.date === date
          ? {
              ...sd,
              slotCapacities: sd.slotCapacities.map((slot, i) =>
                i === index
                  ? {
                      ...slot,
                      [field]:
                        field === "capacity" ? Math.max(1, Number(value || 1)) : value,
                    }
                  : slot,
              ),
            }
          : sd,
      ),
    );
  }

  async function save() {
    setSaving(true);

    const enabledDays = days.filter((d) => d.enabled);
    const weeklyItems = enabledDays.map((d) => ({
      weekday: d.weekday,
      isEnabled: true,
      ranges: d.ranges,
    }));

    const disabledDays = days.filter((d) => !d.enabled);
    const disabledItems = disabledDays.map((d) => ({
      weekday: d.weekday,
      isEnabled: false,
      ranges: [],
    }));

    const qs = professionalId ? `?professionalId=${professionalId}` : "";

    const weeklyRes = await fetch(`/api/backend/availability/weekly${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [...weeklyItems, ...disabledItems] }),
    });

    const specItems = specDates.map((sd) => ({
      date: new Date(sd.date + "T12:00:00").toISOString(),
      isEnabled: sd.enabled,
      ranges: sd.ranges,
      slotCapacities: sd.slotCapacities,
    }));

    const specRes = await fetch(`/api/backend/availability/specific-dates${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: specItems }),
    });

    setSaving(false);

    if (!weeklyRes.ok || !specRes.ok) {
      sileo.error({ title: "No se pudo guardar la disponibilidad" });
      return;
    }

    sileo.success({ title: "Disponibilidad guardada" });
    setScheduleOpen(false);
    router.refresh();
  }

  const enabledCount = days.filter((d) => d.enabled).length;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Horario semanal
            </div>
            <Badge variant={enabledCount > 0 ? "info" : "secondary"}>
              {enabledCount} día{enabledCount !== 1 ? "s" : ""} hábil
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enabledCount === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tenés horarios configurados. Creá tu horario de trabajo.
            </p>
          ) : (
            <div className="space-y-1.5">
              {days
                .filter((d) => d.enabled)
                .map((day) => (
                  <div
                    key={day.weekday}
                    className="flex items-center justify-between rounded-xl bg-primary/[0.03] px-4 py-2.5"
                  >
                    <span className="text-sm font-medium">
                      {WEEKDAY_LABELS[day.weekday]}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {day.ranges.map((r, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs">
                          {r.startTime} – {r.endTime}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-4">
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger
                render={
                  <Button className="gap-2">
                    <Pencil className="size-4" />
                    {enabledCount > 0 ? "Editar horario" : "Crear horario"}
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    Configurar horario semanal
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-2 py-2">
                  {days.map((day) => (
                    <div
                      key={day.weekday}
                      className={`rounded-2xl border transition-all ${
                        day.enabled
                          ? "border-primary/20 bg-primary/[0.02]"
                          : "border-border/50 bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleDay(day.weekday)}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`flex size-6 items-center justify-center rounded-lg border-2 transition-all ${
                                day.enabled
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/25 bg-transparent"
                              }`}
                            >
                              {day.enabled && (
                                <svg
                                  className="size-3.5 text-primary-foreground"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                day.enabled ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {WEEKDAY_LABELS[day.weekday]}
                            </span>
                          </button>

                          {day.enabled && day.ranges.length > 0 && (
                            <div className="flex items-center gap-1">
                              {day.ranges.map((r, i) => (
                                <span
                                  key={i}
                                  className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                                >
                                  {r.startTime}–{r.endTime}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {day.enabled && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(day.weekday)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50"
                          >
                            {day.expanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {day.enabled && day.expanded && (
                        <div className="space-y-2 border-t border-border/40 px-4 py-3">
                          {day.ranges.map((range, i) => (
                            <div
                              key={i}
                              className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 px-3 py-2"
                            >
                              <Input
                                type="time"
                                value={range.startTime}
                                onChange={(e) =>
                                  updateRange(day.weekday, i, "startTime", e.target.value)
                                }
                                className="h-8 w-28 text-xs font-mono"
                              />
                              <span className="text-xs text-muted-foreground">a</span>
                              <Input
                                type="time"
                                value={range.endTime}
                                onChange={(e) =>
                                  updateRange(day.weekday, i, "endTime", e.target.value)
                                }
                                className="h-8 w-28 text-xs font-mono"
                              />
                              <Input
                                type="number"
                                min={1}
                                placeholder="Sin límite"
                                value={range.capacity ?? ""}
                                onChange={(e) =>
                                  updateRange(day.weekday, i, "capacity", e.target.value)
                                }
                                className="h-8 w-28 text-xs"
                              />
                              {day.ranges.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeRange(day.weekday, i)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => addRange(day.weekday)}
                            className="gap-1 text-primary"
                          >
                            <Plus className="size-3" />
                            Agregar franja horaria
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setScheduleOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={save} disabled={saving} className="gap-2">
                    <Save className="size-4" />
                    {saving ? "Guardando..." : "Guardar horario"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            <CalendarDays className="size-4 text-primary" />
            Excepciones por fecha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {specDates.map((sd) => (
            <div
              key={sd.date}
              className={`rounded-2xl border transition-all ${
                sd.enabled
                  ? "border-primary/20 bg-primary/[0.02]"
                  : "border-destructive/20 bg-destructive/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSpecExpand(sd.date)}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm font-medium">
                    {new Date(sd.date + "T12:00:00").toLocaleDateString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  <Badge
                    variant={sd.enabled ? "success" : "destructive"}
                    className="text-[10px]"
                  >
                    {sd.enabled ? "Disponible" : "No disponible"}
                  </Badge>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleSpecExpand(sd.date)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50"
                  >
                    {sd.expanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeSpecDate(sd.date)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>

              {sd.expanded && sd.enabled && (
                <div className="space-y-2 border-t border-border/40 px-4 py-3">
                  {sd.ranges.map((range, i) => (
                    <div
                      key={i}
                              className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 px-3 py-2"
                    >
                      <Input
                        type="time"
                        value={range.startTime}
                        onChange={(e) =>
                          updateSpecDateRange(sd.date, i, "startTime", e.target.value)
                        }
                        className="h-8 w-28 text-xs font-mono"
                      />
                      <span className="text-xs text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={range.endTime}
                        onChange={(e) =>
                          updateSpecDateRange(sd.date, i, "endTime", e.target.value)
                        }
                        className="h-8 w-28 text-xs font-mono"
                      />
                      <Input
                        type="number"
                        min={1}
                        placeholder="Sin límite"
                        value={range.capacity ?? ""}
                        onChange={(e) =>
                          updateSpecDateRange(sd.date, i, "capacity", e.target.value)
                        }
                        className="h-8 w-28 text-xs"
                      />
                      {sd.ranges.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeSpecDateRange(sd.date, i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => addSpecDateRange(sd.date)}
                    className="gap-1 text-primary"
                  >
                    <Plus className="size-3" />
                    Agregar franja
                  </Button>
                  <div className="rounded-lg border border-border/50 bg-background/70 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                        Cupos por horario (opcional)
                      </p>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => addSlotCapacity(sd.date)}
                        className="gap-1 text-primary"
                      >
                        <Plus className="size-3" />
                        Cupo horario
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {sd.slotCapacities.map((slot, i) => (
                        <div key={`${slot.startTime}-${i}`} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) =>
                              updateSlotCapacity(sd.date, i, "startTime", e.target.value)
                            }
                            className="h-8 w-28 text-xs font-mono"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={slot.capacity}
                            onChange={(e) =>
                              updateSlotCapacity(sd.date, i, "capacity", e.target.value)
                            }
                            className="h-8 w-24 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeSlotCapacity(sd.date, i)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {sd.expanded && !sd.enabled && (
                <div className="border-t border-border/40 px-4 py-3">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => toggleSpecDate(sd.date)}
                    className="gap-1"
                  >
                    Marcar como disponible
                  </Button>
                </div>
              )}
            </div>
          ))}

          <div className="rounded-2xl border border-dashed border-border px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Agregar fecha
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha</label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Franjas</label>
                <div className="flex items-center gap-2">
                  {newDateRanges.map((r, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input
                        type="time"
                        value={r.startTime}
                        onChange={(e) =>
                          setNewDateRanges((prev) =>
                            prev.map((rr, ii) =>
                              ii === i ? { ...rr, startTime: e.target.value } : rr
                            )
                          )
                        }
                        className="h-8 w-24 text-xs font-mono"
                      />
                      <span className="text-[10px]">a</span>
                      <Input
                        type="time"
                        value={r.endTime}
                        onChange={(e) =>
                          setNewDateRanges((prev) =>
                            prev.map((rr, ii) =>
                              ii === i ? { ...rr, endTime: e.target.value } : rr
                            )
                          )
                        }
                        className="h-8 w-24 text-xs font-mono"
                      />
                      <Input
                        type="number"
                        min={1}
                        placeholder="Sin límite"
                        value={r.capacity ?? ""}
                        onChange={(e) =>
                          setNewDateRanges((prev) =>
                            prev.map((rr, ii) =>
                              ii === i
                                ? {
                                    ...rr,
                                    capacity:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  }
                                : rr
                            )
                          )
                        }
                        className="h-8 w-24 text-xs"
                      />
                      {newDateRanges.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setNewDateRanges((prev) => prev.filter((_, ii) => ii !== i))
                          }
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setNewDateRanges((prev) => [
                      ...prev,
                      { startTime: "16:00", endTime: "20:00", capacity: null },
                    ])
                  }
                  className="gap-1"
                >
                  <Plus className="size-3" />
                  Franja
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={addNewSpecDate}
                  disabled={!newDate}
                >
                  Agregar
                </Button>
              </div>
            </div>
          </div>

          {specDates.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} size="sm" className="gap-2">
                <Save className="size-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
