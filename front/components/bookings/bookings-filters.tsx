"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BookingStatus } from "@/lib/api/bookings";

const STATUS_OPTIONS: {
  value: BookingStatus | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING_WA_CONFIRMATION", label: "Esperando WA" },
  { value: "WA_CONTACTED", label: "Contactado" },
  { value: "BOOKED", label: "Seña pendiente" },
  { value: "INTAKE_SENT", label: "Ficha enviada" },
  { value: "INTAKE_COMPLETED", label: "Ficha completa" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "EXPIRED", label: "Expirado" },
];

export type BookingsFiltersProps = {
  status: BookingStatus | "ALL";
  month: number;
  year: number;
  onStatusChange: (status: BookingStatus | "ALL") => void;
  onMonthChange: (month: number, year: number) => void;
};

export function BookingsFilters({
  status,
  month,
  year,
  onStatusChange,
  onMonthChange,
}: BookingsFiltersProps) {
  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    onMonthChange(d.getMonth(), d.getFullYear());
  }

  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    onMonthChange(d.getMonth(), d.getFullYear());
  }

  const monthLabel = format(new Date(year, month), "MMMM yyyy", {
    locale: es,
  });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={prevMonth}
          className="inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[8rem] text-center font-display text-base font-semibold capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as BookingStatus | "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
