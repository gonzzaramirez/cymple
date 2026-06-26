"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingCalendarProps = {
  year: number;
  month: number;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
  loading?: boolean;
};

const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  // 0 = Sunday, we want Monday = 0
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6; // Sunday -> last

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let day = 1;

  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < startDow) {
        week.push(null); // prev month padding
      } else if (day <= daysInMonth) {
        week.push(day);
        day++;
      } else {
        week.push(null); // next month padding
      }
    }
    weeks.push(week);
    if (day > daysInMonth) break;
  }

  return { weeks, daysInMonth, startDow };
}

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function BookingCalendar({
  year,
  month,
  availableDates,
  selectedDate,
  onSelectDate,
  onMonthChange,
  loading,
}: BookingCalendarProps) {
  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const today = useMemo(() => {
    const d = new Date();
    return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  function isPastDay(day: number): boolean {
    const key = formatDateKey(year, month, day);
    return key < today;
  }

  function prevMonth() {
    if (month === 0) {
      onMonthChange(year - 1, 11);
    } else {
      onMonthChange(year, month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      onMonthChange(year + 1, 0);
    } else {
      onMonthChange(year, month + 1);
    }
  }

  const monthName = new Date(year, month).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const canGoPrev = year > new Date().getFullYear() || month > new Date().getMonth();

  return (
    <div className="w-full">
      {/* Month header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full transition-colors",
            canGoPrev
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground/30 cursor-not-allowed",
          )}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-display text-base font-semibold capitalize">
          {monthName}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-2 grid grid-cols-7">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, w) => (
            <div key={w} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, d) => (
                <div
                  key={d}
                  className="aspect-square animate-pulse rounded-full bg-muted"
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {grid.weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                if (day === null) {
                  return <div key={di} className="aspect-square" />;
                }

                const dateKey = formatDateKey(year, month, day);
                const isAvailable = availableDates.has(dateKey);
                const isSelected = selectedDate === dateKey;
                const isPast = isPastDay(day);
                const isToday = dateKey === today;
                const canSelect = isAvailable && !isPast;

                return (
                  <button
                    key={di}
                    type="button"
                    disabled={!canSelect}
                    onClick={() => canSelect && onSelectDate(dateKey)}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center rounded-full text-sm font-medium transition-all",
                      isSelected && "bg-primary text-primary-foreground",
                      !isSelected &&
                        canSelect &&
                        "text-foreground hover:bg-muted",
                      !isSelected &&
                        !canSelect &&
                        "text-muted-foreground/30",
                      isToday &&
                        !isSelected &&
                        "ring-1 ring-primary/40",
                    )}
                    aria-label={`${day} de ${monthName}`}
                  >
                    <span>{day}</span>
                    {isAvailable && !isSelected && (
                      <span
                        className={cn(
                          "mt-0.5 block h-1 w-1 rounded-full",
                          isPast
                            ? "bg-muted-foreground/30"
                            : "bg-primary",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
