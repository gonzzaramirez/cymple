"use client";

import { Appointment } from "@/lib/types";
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
} from "lucide-react";

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

  async function setStatus(status: string) {
    const response = await fetch(
      `/api/backend/appointments/${appointment.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      sileo.error({ title: "No se pudo actualizar el estado" });
      return;
    }

    sileo.success({ title: "Estado actualizado" });
    onActionSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-display">
              {appointment.patient
                ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
                : "Sin paciente"}
            </span>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
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
            {appointment.reason && (
              <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="text-sm font-medium">{appointment.reason}</p>
                </div>
              </div>
            )}
          </div>

          {allowed.length > 0 && (
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
                    onClick={() => setStatus(action.status)}
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
