"use client";

import { useEffect, useCallback, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getProfessional,
  getAvailability,
  getSlots,
  createBooking,
  SlotInfo,
  ProfessionalPublic,
} from "@/lib/api/public-booking";
import {
  BookingCalendar,
  BookingTimeSlots,
  BookingFormSheet,
  BookingConfirmation,
  ServiceInfoCard,
} from "@/components/booking";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type PageState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "calendar" }
  | { phase: "booking"; slot: SlotInfo }
  | { phase: "success"; token: string; waDeepLink: string; expiresAt: string }
  | { phase: "error"; message: string };

export default function PublicBookingPage({ slug }: { slug: string }) {
  const [professional, setProfessional] = useState<ProfessionalPublic | null>(
    null,
  );
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | undefined>();

  // Fetch professional on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const prof = await getProfessional(slug);
        if (cancelled) return;
        setProfessional(prof);
        setState({ phase: "calendar" });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message === "NOT_FOUND"
            ? "not-found"
            : "error";
        if (msg === "not-found") {
          setState({ phase: "not-found" });
        } else {
          setState({
            phase: "error",
            message: "Error al cargar la información del profesional",
          });
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Fetch month availability whenever month changes (single request now)
  useEffect(() => {
    let cancelled = false;

    async function loadMonth() {
      setCalendarLoading(true);
      try {
        const firstDay = `${currentMonth.year}-${String(
          currentMonth.month + 1,
        ).padStart(2, "0")}-01`;
        const lastDayDate = new Date(
          currentMonth.year,
          currentMonth.month + 1,
          0,
        );
        const lastDay = `${currentMonth.year}-${String(
          currentMonth.month + 1,
        ).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

        const res = await getAvailability(slug, firstDay, lastDay);
        if (cancelled) return;
        setAvailableDates(new Set(res.dates));
      } catch {
        if (!cancelled) setAvailableDates(new Set());
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }

    loadMonth();
    return () => {
      cancelled = true;
    };
  }, [slug, currentMonth]);

  // Fetch slots when a date is selected
  useEffect(() => {
    const date = selectedDate;
    if (!date) return;

    let cancelled = false;

    async function loadSlots(dateStr: string) {
      setSlotsLoading(true);
      setSlots([]);
      try {
        const res = await getSlots(slug, dateStr);
        if (!cancelled) setSlots(res.slots);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }

    loadSlots(date);
    return () => {
      cancelled = true;
    };
  }, [slug, selectedDate]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      setCurrentMonth({ year, month });
      setSelectedDate(null);
      setSlots([]);
    },
    [],
  );

  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    setState({ phase: "booking", slot });
  }, []);

  const handleFormSubmit = useCallback(
    async (data: { name: string; phone: string }) => {
      if (state.phase !== "booking" || !professional) return;

      setBookingLoading(true);
      setBookingError(undefined);

      try {
        // slotStart / slotEnd are full ISO strings from the API.
        // The backend expects HH:mm (24h, local AR time).
        const startHHmm = new Date(state.slot.startAt).toLocaleTimeString(
          "es-AR",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Argentina/Buenos_Aires",
          },
        );
        const endHHmm = new Date(state.slot.endAt).toLocaleTimeString(
          "es-AR",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Argentina/Buenos_Aires",
          },
        );

        const res = await createBooking({
          professionalSlug: slug,
          slotDate: selectedDate!,
          slotStart: startHHmm,
          slotEnd: endHHmm,
          patientName: data.name,
          patientPhone: data.phone,
        });

        setState({
          phase: "success",
          token: res.token,
          waDeepLink: res.waDeepLink,
          expiresAt: res.expiresAt,
        });
      } catch (err) {
        const msg =
          err instanceof Error && err.message === "SLOT_TAKEN"
            ? "Este horario ya fue reservado. Por favor, seleccioná otro."
            : err instanceof Error
              ? err.message
              : "Error al crear la reserva. Intentá de nuevo.";
        setBookingError(msg);
      } finally {
        setBookingLoading(false);
      }
    },
    [state, professional, slug],
  );

  const handleReset = useCallback(() => {
    setSelectedDate(null);
    setSlots([]);
    setBookingError(undefined);
    setState({ phase: "calendar" });
  }, []);

  // Check if selected date's slots can be shown
  const showSlots = selectedDate !== null;

  // Render based on state
  if (state.phase === "loading" || state.phase === "not-found") {
    return (
      <>
        {state.phase === "not-found" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <AlertCircle className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <h1 className="font-display text-xl font-semibold">
                Profesional no encontrado
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                El profesional que buscás no existe o no está disponible para
                reservas online.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-8">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 rounded-full" />
              <Skeleton className="h-4 w-32 rounded-full" />
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}
      </>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <AlertCircle className="size-12 text-destructive/50" />
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">Error</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
        </div>
      </div>
    );
  }

  if (state.phase === "success") {
    return (
      <BookingConfirmation
        token={state.token}
        waDeepLink={state.waDeepLink}
        expiresAt={state.expiresAt}
        onReset={handleReset}
      />
    );
  }

  const canGoBack = state.phase === "booking";
  const isFormOpen = state.phase === "booking";

  return (
    <div className="space-y-6 py-4">
      {/* Back button when in booking subscreen */}
      {canGoBack && (
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
      )}

      {/* Professional info */}
      {professional && (
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {professional.fullName}
          </h1>
          {professional.specialty && (
            <p className="text-sm text-muted-foreground">
              {professional.specialty}
            </p>
          )}
        </div>
      )}

      {/* Service info card: price / deposit / duration */}
      {professional && <ServiceInfoCard professional={professional} />}

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm",
            !selectedDate
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-4" />
          <span>Fecha</span>
        </div>
        {selectedDate && (
          <>
            <div className="h-px flex-1 bg-border" />
            <div
              className={cn(
                "flex items-center gap-1.5 text-sm",
                !showSlots || state.phase === "calendar"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Clock className="size-4" />
              <span>Horario</span>
            </div>
          </>
        )}
      </div>

      {/* Calendar */}
      <BookingCalendar
        year={currentMonth.year}
        month={currentMonth.month}
        availableDates={availableDates}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        onMonthChange={handleMonthChange}
        loading={calendarLoading}
      />

      {/* Slots */}
      {showSlots && (
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold">
            {format(
              new Date(
                Number(selectedDate.slice(0, 4)),
                Number(selectedDate.slice(5, 7)) - 1,
                Number(selectedDate.slice(8, 10)),
              ),
              "EEEE d MMMM",
              { locale: es },
            )}
          </h2>
          <BookingTimeSlots
            slots={slots}
            selectedSlot={
              state.phase === "booking" ? state.slot.startAt : null
            }
            onSelectSlot={handleSelectSlot}
            loading={slotsLoading}
          />
        </div>
      )}

      {/* Booking form sheet */}
      <BookingFormSheet
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open && state.phase === "booking") {
            setState({ phase: "calendar" });
          }
        }}
        slotDate={state.phase === "booking" ? state.slot.startAt : ""}
        slotStart={state.phase === "booking" ? state.slot.startAt : ""}
        professionalName={professional?.fullName ?? ""}
        onSubmit={handleFormSubmit}
        loading={bookingLoading}
        error={bookingError}
      />
    </div>
  );
}
