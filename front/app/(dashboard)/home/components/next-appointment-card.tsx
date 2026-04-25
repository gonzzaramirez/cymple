"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

type NextAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED";
  reason?: string | null;
  durationMinutes: number;
  minutesUntilStart: number;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "Ahora";
  if (minutes < 60) return `en ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `en ${h}h ${m}min` : `en ${h}h`;
}

const statusConfig = {
  PENDING: {
    label: "Pendiente de confirmación",
    icon: Clock,
    bar: "bg-yellow-400",
    text: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
  },
  CONFIRMED: {
    label: "Confirmado",
    icon: CheckCircle2,
    bar: "bg-[#34c759]",
    text: "text-[#248a3d] dark:text-[#30d158]",
    bg: "bg-green-50 dark:bg-green-950/40",
  },
};

export function NextAppointmentCard({
  initial,
}: {
  initial: NextAppointment | null;
}) {
  const [apt, setApt] = useState<NextAppointment | null>(initial);
  const [acting, setActing] = useState(false);

  // Refresh countdown every minute
  useEffect(() => {
    if (!apt) return;
    const interval = setInterval(() => {
      const mins = Math.max(
        0,
        Math.round(
          (new Date(apt.startAt).getTime() - Date.now()) / 60000,
        ),
      );
      setApt((prev) => (prev ? { ...prev, minutesUntilStart: mins } : prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, [apt?.startAt]);

  async function setStatus(status: "ATTENDED" | "ABSENT") {
    if (!apt) return;
    setActing(true);
    const res = await fetch(`/api/backend/appointments/${apt.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActing(false);
    if (!res.ok) {
      sileo.error({ title: "No se pudo actualizar el estado" });
      return;
    }
    sileo.success({ title: status === "ATTENDED" ? "Marcado como atendido" : "Marcado como ausente" });
    setApt(null);
  }

  if (!apt) {
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Próxima cita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Calendar className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No hay más citas pendientes hoy
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cfg = statusConfig[apt.status];
  const Icon = cfg.icon;
  const time = format(new Date(apt.startAt), "HH:mm", { locale: es });
  const name = `${apt.patient.firstName} ${apt.patient.lastName}`;
  const isStarting = apt.minutesUntilStart <= 10;

  return (
    <Card className={cn("shadow-card overflow-hidden", isStarting && "ring-2 ring-primary/40")}>
      {/* Accent bar */}
      <div className={cn("h-1 w-full", cfg.bar)} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Próxima cita
        </CardTitle>
        <Link
          href={`/appointments`}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver agenda
          <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Patient + time */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold tracking-[-0.02em]">
              {name}
            </p>
            {apt.reason && (
              <p className="mt-0.5 text-sm text-muted-foreground wrap-break-word">
                {apt.reason}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-2xl font-semibold tabular-nums tracking-[-0.02em]">
              {time}
            </p>
            <p className={cn("text-xs font-medium", isStarting ? "text-primary" : "text-muted-foreground")}>
              {formatCountdown(apt.minutesUntilStart)}
            </p>
          </div>
        </div>

        {/* Status pill */}
        <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1", cfg.bg)}>
          <Icon className={cn("size-3.5", cfg.text)} />
          <span className={cn("text-xs font-medium", cfg.text)}>{cfg.label}</span>
        </div>

        {/* Quick actions — only once started */}
        {apt.minutesUntilStart <= 0 && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={acting}
              className="bg-[#34c759]/10 text-[#248a3d] hover:bg-[#34c759]/20 dark:text-[#30d158]"
              onClick={() => setStatus("ATTENDED")}
            >
              <CheckCircle2 className="size-4" />
              Atendido
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={acting}
              className="bg-[#ff9500]/10 text-[#c77700] hover:bg-[#ff9500]/20"
              onClick={() => setStatus("ABSENT")}
            >
              <AlertCircle className="size-4" />
              Ausente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
