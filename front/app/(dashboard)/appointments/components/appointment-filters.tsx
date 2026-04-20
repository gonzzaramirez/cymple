"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { X, Filter, CalendarIcon } from "lucide-react";
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
};

export function AppointmentFilters({ view, onCreateAppointment }: AppointmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeStatuses = searchParams.get("status")?.split(",") ?? [];
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

  const [search, setSearch] = useState(searchQuery);
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
    router.push(`${pathname}?${params.toString()}`);
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
    setSearch("");
    setDateRange(undefined);
    router.push(pathname);
  }

  const hasActiveFilters =
    activeStatuses.length > 0 || searchQuery || dateRange?.from;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {isCalendar ? (
          <div className="min-w-[220px] max-w-xs flex-1">
            <PatientSearchPreview onCreateAppointment={onCreateAppointment} />
          </div>
        ) : (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Input
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({ search: search || undefined });
                }
              }}
              className="h-9 pl-3 text-sm"
            />
          </div>
        )}

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger
            render={
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
              >
                <Filter className="size-3.5" />
                Filtros
                {activeStatuses.length > 0 && (
                  <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">
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
      </div>
    </div>
  );
}
