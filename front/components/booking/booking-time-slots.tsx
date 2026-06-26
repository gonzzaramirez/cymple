"use client";

import { cn } from "@/lib/utils";
import { SlotInfo } from "@/lib/api/public-booking";

export type BookingTimeSlotsProps = {
  slots: SlotInfo[];
  selectedSlot: string | null;
  onSelectSlot: (slot: SlotInfo) => void;
  loading?: boolean;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function BookingTimeSlots({
  slots,
  selectedSlot,
  onSelectSlot,
  loading,
}: BookingTimeSlotsProps) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-11 w-24 animate-pulse rounded-full bg-muted"
          />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No hay horarios disponibles para esta fecha
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => {
        const isSelected = selectedSlot === slot.startAt;
        const isFull =
          slot.hasCapacityLimit &&
          slot.remainingCapacity !== null &&
          slot.remainingCapacity <= 0;

        return (
          <button
            key={slot.startAt}
            type="button"
            disabled={isFull}
            onClick={() => !isFull && onSelectSlot(slot)}
            className={cn(
              "inline-flex h-11 min-w-[5.5rem] items-center justify-center rounded-full px-5 text-[15px] font-medium transition-all",
              isSelected &&
                "bg-primary text-primary-foreground shadow-sm",
              !isSelected &&
                !isFull &&
                "bg-muted text-foreground hover:bg-muted/80 active:scale-95",
              isFull &&
                "cursor-not-allowed bg-muted/50 text-muted-foreground/50 line-through",
            )}
          >
            {formatTime(slot.startAt)}
          </button>
        );
      })}
    </div>
  );
}
