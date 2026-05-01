import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  startAt: string;
  status: "PENDING" | "CONFIRMED";
  patient: { id: string; firstName: string; lastName: string };
  professional?: { id: string; fullName: string } | null;
};

const statusLabel: Record<Appointment["status"], string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
};

const statusStyle: Record<Appointment["status"], string> = {
  PENDING: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  CONFIRMED: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
};

export function CenterUpcomingToday({ appointments }: { appointments: Appointment[] }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Proximas citas hoy
        </CardTitle>
        <Link href="/center/appointments" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Ver agenda
          <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CalendarCheck className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay mas citas programadas para hoy</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {appointments.map((appointment) => {
              const time = format(new Date(appointment.startAt), "HH:mm", { locale: es });
              const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
              return (
                <li key={appointment.id}>
                  <Link href="/center/appointments" className="flex items-center gap-3 py-3 transition-colors hover:text-foreground">
                    <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-foreground">{time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground/80">{patientName}</span>
                      {appointment.professional?.fullName && (
                        <span className="block truncate text-xs text-muted-foreground">{appointment.professional.fullName}</span>
                      )}
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", statusStyle[appointment.status])}>
                      {statusLabel[appointment.status]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
