"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getBookingStatus } from "@/lib/api/public-booking";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Status = {
  status: string;
  depositStatus: string;
  depositAmount: string | null;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "warning" | "success" | "info" | "destructive" | "secondary" }> = {
  PENDING_WA_CONFIRMATION: { label: "Esperando confirmación por WhatsApp", variant: "warning" },
  WA_CONTACTED: { label: "WhatsApp recibido", variant: "info" },
  BOOKED: { label: "Seña pendiente", variant: "warning" },
  INTAKE_SENT: { label: "Ficha de ingreso enviada", variant: "info" },
  INTAKE_COMPLETED: { label: "Confirmada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  EXPIRED: { label: "Expirada", variant: "secondary" },
};

function formatSlot(status: Status): string {
  try {
    const datePart = status.slotDate.slice(0, 10);
    const d = new Date(`${datePart}T${status.slotStart}:00`);
    return `${format(d, "EEEE dd 'de' MMMM 'a las' HH:mm", { locale: es })}hs`;
  } catch {
    return `${status.slotDate} ${status.slotStart}-${status.slotEnd}`;
  }
}

export default function BookingStatusPage() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Auto-load if token in URL
  useEffect(() => {
    if (initialToken) {
      void handleSearch(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(tokenOverride?: string) {
    const t = (tokenOverride ?? token).trim();
    if (!t) {
      setError("Ingresá tu código de reserva");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await getBookingStatus(t);
      setStatus(res);
    } catch (err) {
      const msg =
        err instanceof Error && err.message === "NOT_FOUND"
          ? "No encontramos una reserva con ese código. Verificá que esté bien escrito."
          : "Error al consultar el estado. Intentá de nuevo.";
      setError(msg);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  const statusCfg = status
    ? status.status === "BOOKED" && status.depositStatus !== "PENDING"
      ? { label: "Confirmada", variant: "success" as const }
      : STATUS_LABELS[status.status]
    : null;
  const showDeposit =
    status &&
    status.depositStatus === "PENDING" &&
    status.depositAmount &&
    Number(status.depositAmount) > 0;

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Estado de tu reserva
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresá tu código para ver el estado actual.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSearch();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="R-001"
          maxLength={8}
          className="flex h-11 flex-1 rounded-full border border-border/60 bg-card px-4 font-mono text-sm uppercase tracking-wider outline-none transition-colors focus:border-primary"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Consultar
        </button>
      </form>

      {loading && (
        <div className="space-y-3 rounded-2xl border border-border/50 p-4">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {status && statusCfg && !loading && (
        <div className="space-y-4 rounded-2xl border border-border/50 bg-card/30 p-5">
          <div className="flex items-center justify-between">
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Turno
              </p>
              <p className="mt-0.5 font-medium capitalize">
                {formatSlot(status)}
              </p>
            </div>

            {showDeposit && (
              <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      Seña pendiente: ${Number(status.depositAmount).toLocaleString("es-AR")}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
                      Enviá el comprobante por WhatsApp para confirmar tu turno.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status.status === "BOOKED" && !showDeposit && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#34c759]" />
                <p className="text-muted-foreground">
                  Tu turno está confirmado. ¡Te esperamos!
                </p>
              </div>
            )}

            {status.status === "CANCELLED" && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-destructive">
                  Esta reserva fue cancelada. Si querés reservar de nuevo,
                  ingresá a la página del profesional.
                </p>
              </div>
            )}

            {status.status === "EXPIRED" && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Esta reserva expiró. Volvé a la página del profesional para
                  reservar un nuevo turno.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!searched && !loading && (
        <p className="text-center text-xs text-muted-foreground">
          Tu código tiene el formato{" "}
           <span className="font-mono font-medium">R-001</span> (ej.

          números).
        </p>
      )}
    </div>
  );
}
