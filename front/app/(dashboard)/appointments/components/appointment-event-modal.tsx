"use client";

import { useState } from "react";
import { Appointment, PaymentMethod } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sileo } from "sileo";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Video,
  Banknote,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info";
  }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  ATTENDED: { label: "Atendido", variant: "success" },
  ABSENT: { label: "Ausente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

const statusMap: Record<string, { status: string; label: string }[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirmar" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
  CONFIRMED: [
    { status: "ATTENDED", label: "Atendido" },
    { status: "ABSENT", label: "Ausente" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
};

const actionStyles: Record<string, string> = {
  CONFIRMED: "bg-primary/10 text-primary hover:bg-primary/20",
  ATTENDED: "bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20",
  ABSENT: "bg-[#ff9500]/10 text-[#c77700] hover:bg-[#ff9500]/20",
  CANCELLED: "bg-destructive/10 text-destructive hover:bg-destructive/20",
};

type AppointmentEventModalProps = {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
};

export function AppointmentEventModal({
  appointment,
  open,
  onClose,
  onActionSuccess,
}: AppointmentEventModalProps) {
  const cfg = statusConfig[appointment.status] ?? {
    label: appointment.status,
    variant: "secondary" as const,
  };
  const allowed = statusMap[appointment.status] ?? [];

  const [pendingAttended, setPendingAttended] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function handleClose() {
    setPendingAttended(false);
    setSelectedPayment(null);
    onClose();
  }

  async function setStatus(status: string, paymentMethod?: PaymentMethod) {
    setActionLoading(true);
    const body: Record<string, unknown> = { status };
    if (paymentMethod) body.paymentMethod = paymentMethod;

    const response = await fetch(
      `/api/backend/appointments/${appointment.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    setActionLoading(false);

    if (!response.ok) {
      sileo.error({ title: "No se pudo actualizar el estado" });
      return;
    }

    setPendingAttended(false);
    setSelectedPayment(null);
    sileo.success({ title: "Estado actualizado" });
    onActionSuccess();
  }

  function handleActionClick(status: string) {
    if (status === "ATTENDED") {
      setPendingAttended(true);
      return;
    }
    void setStatus(status);
  }

  const isVirtual = appointment.modality === "VIRTUAL";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-display">
              {appointment.patient
                ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
                : "Sin paciente"}
            </span>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            {(appointment.patient as { absentCount?: number })?.absentCount ? (
              <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                <AlertCircle className="size-3" />
                {(appointment.patient as { absentCount?: number }).absentCount} ausencia{(appointment.patient as { absentCount?: number }).absentCount! > 1 ? "s" : ""}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
              <Clock className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="text-sm font-medium">
                  {format(new Date(appointment.startAt), "EEE dd/MM HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
              <Clock className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duración</p>
                <p className="text-sm font-medium">
                  {appointment.durationMinutes} min
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
              <DollarSign className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Honorario</p>
                <p className="text-sm font-mono font-medium">
                  $ {appointment.fee}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
              {isVirtual ? (
                <Video className="size-4 text-muted-foreground" />
              ) : (
                <MapPin className="size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Modalidad</p>
                <p className="text-sm font-medium">
                  {isVirtual ? "Virtual" : "Presencial"}
                </p>
              </div>
            </div>
            {appointment.reason && (
              <div className="col-span-2 flex items-start gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="text-sm font-medium leading-relaxed wrap-break-word whitespace-pre-wrap">
                    {appointment.reason}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Selector de pago inline al marcar ATENDIDO */}
          {pendingAttended && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                ¿Cómo pagó el paciente?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPayment("CASH")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    selectedPayment === "CASH"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Banknote className="size-4" />
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment("TRANSFER")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    selectedPayment === "TRANSFER"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <ArrowLeftRight className="size-4" />
                  Transferencia
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Si pagó por transferencia, se enviará un recordatorio automático de pago a las 24hs.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setPendingAttended(false);
                    setSelectedPayment(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20"
                  disabled={!selectedPayment || actionLoading}
                  onClick={() => selectedPayment && void setStatus("ATTENDED", selectedPayment)}
                >
                  <CheckCircle2 className="size-4" />
                  {actionLoading ? "Guardando..." : "Confirmar asistencia"}
                </Button>
              </div>
            </div>
          )}

          {!pendingAttended && allowed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Acciones
              </p>
              <div className="flex flex-wrap gap-2">
                {allowed.map((action) => (
                  <Button
                    key={action.status}
                    variant="ghost"
                    size="sm"
                    className={actionStyles[action.status] ?? ""}
                    onClick={() => handleActionClick(action.status)}
                  >
                    {action.status === "ATTENDED" && (
                      <CheckCircle2 className="size-4" />
                    )}
                    {action.status === "ABSENT" && (
                      <AlertCircle className="size-4" />
                    )}
                    {action.status === "CANCELLED" && (
                      <XCircle className="size-4" />
                    )}
                    {action.status === "CONFIRMED" && (
                      <CheckCircle2 className="size-4" />
                    )}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
