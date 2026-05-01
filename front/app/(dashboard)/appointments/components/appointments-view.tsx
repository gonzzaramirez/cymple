"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, List } from "lucide-react";
import { AppointmentFilters } from "./appointment-filters";
import { ScheduleCalendar } from "./schedule-calendar";
import { AppointmentsList } from "./appointments-list";
import {
  CreateAppointmentDialog,
  CreateAppointmentDialogHandle,
} from "./create-appointment-dialog";
import { ApiList, Appointment } from "@/lib/types";

const VIEW_OPTIONS = [
  { value: "calendar" as const, label: "Calendario", icon: Calendar, ui: "calendar" as const },
  { value: "list" as const, label: "Lista", icon: List, ui: "list" as const },
] as const;

type AppointmentsViewProps = {
  mode: "calendar" | "list";
  listData: ApiList<Appointment> | null;
  calendarItems: Appointment[];
  initialDate: string;
};

export function AppointmentsView({
  mode,
  listData,
  calendarItems,
  initialDate,
}: AppointmentsViewProps) {
  const createDialogRef = useRef<CreateAppointmentDialogHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hideWeekends = searchParams.get("weekends") !== "on";
  const [optimisticCreated, setOptimisticCreated] = useState<Appointment[]>([]);
  const optimisticItems = useMemo(() => {
    const map = new Map<string, Appointment>();
    for (const item of calendarItems) {
      map.set(item.id, item);
    }
    for (const item of optimisticCreated) {
      map.set(item.id, item);
    }
    return [...map.values()].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
  }, [calendarItems, optimisticCreated]);

  const setUi = useCallback(
    (ui: "calendar" | "list") => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("ui", ui);
      if (ui === "list") {
        if (!p.get("page")) p.set("page", "1");
        if (!p.get("limit")) p.set("limit", "20");
      }
      router.push(`/appointments?${p.toString()}`);
    },
    [router, searchParams],
  );

  const handleAppointmentCreated = useCallback(
    (createdAppointment: Appointment) => {
      setOptimisticCreated((prev) => {
        if (prev.some((item) => item.id === createdAppointment.id)) {
          return prev;
        }
        return [...prev, createdAppointment];
      });

      const p = new URLSearchParams(searchParams.toString());
      p.set("date", createdAppointment.startAt);
      p.set("ui", "calendar");
      router.push(`/appointments?${p.toString()}`);
      router.refresh();
    },
    [router, searchParams],
  );

  const handleCreateFromPreview = useCallback(
    (patientId: string, patientName: string) => {
      createDialogRef.current?.openWithPatient(patientId, patientName);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <AppointmentFilters
        view={mode === "list" ? "table" : "calendar"}
        onCreateAppointment={handleCreateFromPreview}
        hideWeekends={hideWeekends}
        endActions={
          <>
            <div
              className="inline-flex h-10 w-full min-w-0 items-stretch justify-center overflow-hidden rounded-lg border border-border/70 bg-background/30 p-0.5 sm:h-9 sm:min-w-0 sm:w-auto sm:shrink-0"
              role="tablist"
              aria-label="Vista de agenda"
            >
              {VIEW_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setUi(opt.ui)}
                    className={`inline-flex min-h-0 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:flex-none sm:px-3 ${
                      active
                        ? "bg-muted/90 text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="w-full min-[480px]:w-auto min-[480px]:shrink-0 [&_button]:h-10 [&_button]:w-full min-[480px]:[&_button]:h-9 min-[480px]:[&_button]:w-auto">
              <CreateAppointmentDialog
                ref={createDialogRef}
                onSuccess={handleAppointmentCreated}
              />
            </div>
          </>
        }
      />

      {mode === "calendar" ? (
        <ScheduleCalendar
          items={optimisticItems}
          selectedDate={initialDate}
          hideWeekends={hideWeekends}
        />
      ) : listData ? (
        <AppointmentsList
          items={listData.items}
          page={listData.page}
          totalPages={listData.totalPages}
          total={listData.total}
          limit={listData.limit}
        />
      ) : null}
    </div>
  );
}
