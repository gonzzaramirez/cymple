"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { X, Filter, CalendarIcon, Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { PatientSearchPreview } from "./patient-search-preview";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente", variant: "warning" as const },
  { value: "CONFIRMED", label: "Confirmado", variant: "info" as const },
  { value: "ATTENDED", label: "Atendido", variant: "success" as const },
  { value: "ABSENT", label: "Ausente", variant: "destructive" as const },
  { value: "CANCELLED", label: "Cancelado", variant: "secondary" as const },
];

type AppointmentFiltersProps = {
  view: "calendar" | "table";
  onCreateAppointment: (patientId: string, patientName: string) => void;
  /** Vista calendario/lista, nuevo turno, etc. (sin contenedor tipo card) */
  endActions?: ReactNode;
};

export function AppointmentFilters({ view, onCreateAppointment, endActions }: AppointmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeStatuses = (() => {
    const all = searchParams.getAll("status");
    if (all.length > 0) return all;
    return (searchParams.get("status")?.split(",") ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
  })();
  const searchQuery = searchParams.get("search") ?? "";
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    }
    return undefined;
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const isCalendar = view === "calendar";

  function updateFilters(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    if (params.get("ui") === "list") {
      params.set("page", "1");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyListSearch() {
    const el = document.getElementById("appt-list-search") as HTMLInputElement | null;
    const v = el?.value?.trim() ?? "";
    updateFilters({ search: v || undefined });
  }

  function toggleStatus(status: string) {
    const current = [...activeStatuses];
    const idx = current.indexOf(status);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(status);
    }
    updateFilters({ status: current.length ? current.join(",") : undefined });
  }

  function clearAll() {
    setDateRange(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("from");
    params.delete("to");
    params.delete("search");
    if (params.get("ui") === "list") {
      params.set("page", "1");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasActiveFilters =
    activeStatuses.length > 0 || searchQuery || dateRange?.from;

  return (
    <div className="border-b border-border/50 pb-5 md:pb-6">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4 xl:items-center">
          {isCalendar ? (
            <div className="min-w-0 w-full flex-1 lg:max-w-xl xl:max-w-2xl">
              <PatientSearchPreview onCreateAppointment={onCreateAppointment} />
            </div>
          ) : (
            <div className="flex min-w-0 w-full flex-1 flex-col gap-2 sm:flex-row sm:items-stretch lg:max-w-2xl xl:max-w-3xl">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="appt-list-search"
                  key={searchQuery}
                  defaultValue={searchQuery}
                  placeholder="Buscar por nombre, apellido, DNI, teléfono o email del paciente…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyListSearch();
                    }
                  }}
                  className="h-10 w-full pl-9 pr-3 text-sm shadow-none md:h-9"
                />
              </div>
              <Button
                type="button"
                className="h-10 w-full shrink-0 sm:h-9 sm:w-auto"
                onClick={applyListSearch}
              >
                Buscar
              </Button>
            </div>
          )}

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-2 lg:ml-auto lg:w-auto lg:flex-nowrap lg:justify-end">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    size="sm"
                    className="h-10 w-full justify-center gap-1.5 sm:h-9 sm:min-w-[7.5rem] sm:w-auto"
                  >
                    <Filter className="size-3.5 shrink-0" />
                    Filtros
                    {activeStatuses.length > 0 && (
                      <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">
                        {activeStatuses.length}
                      </span>
                    )}
                  </Button>
                }
              />
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Estado
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = activeStatuses.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleStatus(opt.value)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Rango de fechas
                </p>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 text-sm font-normal"
                      >
                        <CalendarIcon className="size-3.5" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM/yy", { locale: es })}{" "}
                              — {format(dateRange.to, "dd/MM/yy", { locale: es })}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yy", { locale: es })
                          )
                        ) : (
                          "Seleccionar rango"
                        )}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        if (range?.from) {
                          updateFilters({
                            from: range.from.toISOString(),
                            to: range.to?.toISOString(),
                          });
                        } else {
                          updateFilters({ from: undefined, to: undefined });
                        }
                      }}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearAll}
                  className="w-full"
                >
                  <X className="size-3" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {endActions}
      </div>
    </div>
    </div>
  );
}
