"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Appointment, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, Banknote, ArrowLeftRight } from "lucide-react";

const statusMap = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirmar" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
  CONFIRMED: [
    { status: "ATTENDED", label: "Atendido" },
    { status: "ABSENT", label: "Ausente" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
} as const;

const actionStyles: Record<string, string> = {
  CONFIRMED: "bg-primary/10 text-primary hover:bg-primary/20",
  ATTENDED: "bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20",
  ABSENT: "bg-[#ff9500]/10 text-[#c77700] hover:bg-[#ff9500]/20",
  CANCELLED: "bg-destructive/10 text-destructive hover:bg-destructive/20",
};

export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const allowed = statusMap[appointment.status as keyof typeof statusMap] ?? [];

  const [pendingAttended, setPendingAttended] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (!allowed.length) {
    return null;
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
      },
    );
    setActionLoading(false);

    if (!response.ok) {
      sileo.error({ title: "No se pudo actualizar el estado" });
      return;
    }

    setPendingAttended(false);
    setSelectedPayment(null);
    sileo.success({ title: "Estado actualizado" });
    router.refresh();
  }

  function handleActionClick(status: string) {
    if (status === "ATTENDED") {
      setPendingAttended(true);
      return;
    }
    void setStatus(status);
  }

  if (pendingAttended) {
    return (
      <div className="flex flex-col gap-2 w-full min-w-[220px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          ¿Cómo pagó?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedPayment("CASH")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
              selectedPayment === "CASH"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <Banknote className="size-3.5" />
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => setSelectedPayment("TRANSFER")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
              selectedPayment === "TRANSFER"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <ArrowLeftRight className="size-3.5" />
            Transferencia
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="xs"
            className="flex-1"
            onClick={() => {
              setPendingAttended(false);
              setSelectedPayment(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            size="xs"
            className="flex-1 bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20"
            disabled={!selectedPayment || actionLoading}
            onClick={() => selectedPayment && void setStatus("ATTENDED", selectedPayment)}
          >
            <CheckCircle2 className="size-3.5" />
            {actionLoading ? "..." : "Confirmar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowed.map((action) => (
        <Button
          key={action.status}
          variant="ghost"
          size="xs"
          className={actionStyles[action.status] ?? ""}
          onClick={() => handleActionClick(action.status)}
        >
          {action.status === "ATTENDED" && <CheckCircle2 className="size-3.5" />}
          {action.status === "ABSENT" && <AlertCircle className="size-3.5" />}
          {action.status === "CANCELLED" && <XCircle className="size-3.5" />}
          {action.status === "CONFIRMED" && <CheckCircle2 className="size-3.5" />}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
