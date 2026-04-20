"use client";

import { useRouter } from "next/navigation";
import { Appointment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";

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

  if (!allowed.length) {
    return null;
  }

  async function setStatus(status: string) {
    const response = await fetch(
      `/api/backend/appointments/${appointment.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );

    if (!response.ok) {
      sileo.error({ title: "No se pudo actualizar el estado" });
      return;
    }

    sileo.success({ title: "Estado actualizado" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowed.map((action) => (
        <Button
          key={action.status}
          variant="ghost"
          size="xs"
          className={actionStyles[action.status] ?? ""}
          onClick={() => setStatus(action.status)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
