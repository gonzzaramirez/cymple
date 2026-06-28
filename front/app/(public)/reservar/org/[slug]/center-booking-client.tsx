"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getOrganizationProfessionals,
  getAvailability,
  getSlots,
  createBooking,
  type SlotInfo,
  type OrganizationProfessional,
} from "@/lib/api/public-booking";
import {
  BookingCalendar,
  BookingTimeSlots,
  BookingFormSheet,
  BookingConfirmation,
  ServiceInfoCard,
} from "@/components/booking";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, CalendarDays, Clock, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

type PageState =
  | { phase: "loading" }
  | { phase: "selecting"; professionals: OrganizationProfessional[] }
  | { phase: "not-found" }
  | { phase: "error"; message: string }
  | { phase: "calendar"; professional: OrganizationProfessional }
  | { phase: "booking"; professional: OrganizationProfessional; slot: SlotInfo }
  | { phase: "success"; token: string; waDeepLink: string; expiresAt: string };

export function CenterBookingClient({ orgSlug }: { orgSlug: string }) {
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

  // Fetch organization professionals on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const professionals = await getOrganizationProfessionals(orgSlug);
        if (cancelled) return;
        if (professionals.length === 0) {
          setState({ phase: "not-found" });
          return;
        }
        setState({ phase: "selecting", professionals });
      } catch {
        if (cancelled) return;
        setState({
          phase: "error",
          message: "Error al cargar los profesionales del centro",
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  // Select a professional — move to calendar phase
  const handleSelectProfessional = useCallback((prof: OrganizationProfessional) => {
    setState({ phase: "calendar", professional: prof });
    setSelectedDate(null);
    setSlots([]);
    setCurrentMonth(() => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    });
  }, []);

  // Back to professional selection
  const handleBackToSelection = useCallback(() => {
    if (state.phase === "calendar" || state.phase === "booking") {
      setState({ phase: "selecting", professionals: [] });
    }
  }, [state]);

  // Re-fetch professionals list when coming back
  useEffect(() => {
    if (state.phase === "selecting" && state.professionals.length === 0) {
      getOrganizationProfessionals(orgSlug).then((pros) => {
        setState({ phase: "selecting", professionals: pros });
      }).catch(() => {
        setState({ phase: "error", message: "Error al cargar los profesionales" });
      });
    }
  }, [state, orgSlug]);

  const selectedProfessional =
    state.phase === "calendar" || state.phase === "booking"
      ? state.professional
      : null;

  // Use publicBookingSlug for API calls (availability, slots, create)
  const activeSlug = selectedProfessional?.publicBookingSlug ?? null;

  // Fetch month availability when in calendar phase
  useEffect(() => {
    if (state.phase !== "calendar" || !activeSlug) return;
    const slug = activeSlug; // narrow for closure
    let cancelled = false;

    async function loadMonth() {
      setCalendarLoading(true);
      try {
        const firstDay = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`;
        const lastDayDate = new Date(currentMonth.year, currentMonth.month + 1, 0);
        const lastDay = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

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
    return () => { cancelled = true; };
  }, [state.phase, currentMonth, activeSlug]);

  // Fetch slots when a date is selected
  useEffect(() => {
    if (!selectedDate || !activeSlug) return;
    const slug = activeSlug; // narrow for closure
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

    loadSlots(selectedDate);
    return () => { cancelled = true; };
  }, [activeSlug, selectedDate]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setCurrentMonth({ year, month });
    setSelectedDate(null);
    setSlots([]);
  }, []);

  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    if (state.phase !== "calendar") return;
    setState({ phase: "booking", professional: state.professional, slot });
  }, [state]);

  const handleFormSubmit = useCallback(
    async (data: { name: string; phone: string }) => {
      if (state.phase !== "booking" || !activeSlug) return;

      setBookingLoading(true);
      setBookingError(undefined);

      try {
        const startHHmm = new Date(state.slot.startAt).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Argentina/Buenos_Aires",
        });
        const endHHmm = new Date(state.slot.endAt).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Argentina/Buenos_Aires",
        });

        const res = await createBooking({
          professionalSlug: activeSlug,
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
    [state, activeSlug, selectedDate],
  );

  const handleReset = useCallback(() => {
    setSelectedDate(null);
    setSlots([]);
    setBookingError(undefined);
    if (state.phase === "success") {
      setState({ phase: "selecting", professionals: [] });
    }
  }, [state]);

  // ── Render states ──────────────────────────────────────────────

  // Loading / not-found
  if (state.phase === "loading" || state.phase === "not-found") {
    return (
      <>
        {state.phase === "not-found" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <AlertCircle className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <h1 className="font-display text-xl font-semibold">
                Centro no encontrado
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                El centro médico que buscás no tiene profesionales disponibles
                para reservas online.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-8">
            <Skeleton className="h-6 w-48 rounded-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  // Error
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

  // Success
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

  // ── Selecting phase: show professional grid ──────────────────
  if (state.phase === "selecting") {
    return (
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Centro Médico
          </h1>
          <p className="text-sm text-muted-foreground">
            Seleccioná tu profesional para reservar un turno online
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.professionals.map((prof) => (
            <button
              key={prof.id}
              onClick={() => handleSelectProfessional(prof)}
              className="group rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:shadow-card-hover hover:border-primary/20 active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Stethoscope className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold truncate group-hover:text-primary transition-colors">
                    {prof.fullName}
                  </h3>
                  {prof.specialty && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {prof.specialty}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {prof.standardFee && (
                      <span className="tabular-nums">
                        <span className="font-semibold text-foreground">$ {String(prof.standardFee)}</span>
                        {" / consulta"}
                      </span>
                    )}
                    {prof.consultationMinutes && (
                      <span>
                        {prof.consultationMinutes} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Calendar / Booking phase ──────────────────────────────────
  const professional = state.phase === "calendar"
    ? state.professional
    : state.phase === "booking"
      ? state.professional
      : null;

  const isBookingPhase = state.phase === "booking";
  const showSlots = selectedDate !== null;

  return (
    <div className="space-y-6 py-4">
      {/* Back button */}
      <button
        type="button"
        onClick={handleBackToSelection}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {isBookingPhase ? "Volver a horarios" : "Cambiar profesional"}
      </button>

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

      {/* Service info card */}
      {professional && <ServiceInfoCard professional={professional as any} />}

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center gap-1.5 text-sm",
          !selectedDate
            ? "font-medium text-foreground"
            : "text-muted-foreground",
        )}>
          <CalendarDays className="size-4" />
          <span>Fecha</span>
        </div>
        {selectedDate && (
          <>
            <div className="h-px flex-1 bg-border" />
            <div className={cn(
              "flex items-center gap-1.5 text-sm",
              !isBookingPhase
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}>
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
                Number(selectedDate!.slice(0, 4)),
                Number(selectedDate!.slice(5, 7)) - 1,
                Number(selectedDate!.slice(8, 10)),
              ),
              "EEEE d MMMM",
              { locale: es },
            )}
          </h2>
          <BookingTimeSlots
            slots={slots}
            selectedSlot={isBookingPhase ? state.slot.startAt : null}
            onSelectSlot={handleSelectSlot}
            loading={slotsLoading}
          />
        </div>
      )}

      {/* Booking form sheet */}
      <BookingFormSheet
        open={isBookingPhase}
        onOpenChange={(open) => {
          if (!open && state.phase === "booking") {
            setState({ phase: "calendar", professional: state.professional });
            setBookingError(undefined);
          }
        }}
        slotDate={isBookingPhase ? state.slot.startAt : ""}
        slotStart={isBookingPhase ? state.slot.startAt : ""}
        professionalName={professional?.fullName ?? ""}
        onSubmit={handleFormSubmit}
        loading={bookingLoading}
        error={bookingError}
      />
    </div>
  );
}
