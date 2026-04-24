import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { serverApiFetch } from "@/lib/server-api";
import { StatsCards } from "./components/stats-cards";
import { WeeklyChart } from "./components/weekly-chart";

import { NextAppointmentCard } from "./components/next-appointment-card";

type MeResponse = {
  fullName: string;
};

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

type DashboardStats = {
  patientsTotal: number;
  patientsThisWeek: number;
  appointmentsThisWeek: number;
  appointmentsToday: number;
  pendingNext24h: number;
  nextAppointment: NextAppointment | null;
  upcomingToday: Array<{
    id: string;
    startAt: string;
    status: "PENDING" | "CONFIRMED";
    patient: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  financeThisMonth: {
    income: number;
    expense: number;
    net: number;
    occupancyPercent: number;
    attendedCount: number;
  };
  weeklyChart: Array<{
    day: string;
    total: number;
    attended: number;
  }>;
};

export default async function HomePage() {
  const [me, stats] = await Promise.all([
    serverApiFetch<MeResponse>("auth/me"),
    serverApiFetch<DashboardStats>("dashboard/stats"),
  ]);

  const firstName = me.fullName.split(" ")[0];
  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            Bienvenido, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {todayCapitalized}
          </p>
        </div>
      </div>

      {/* Feature 2: Alerta de citas pendientes en las próximas 24h */}
      {stats.pendingNext24h > 0 && (
        <Link
          href="/appointments"
          className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800 transition-colors hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300 dark:hover:bg-yellow-950/60"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {stats.pendingNext24h === 1
              ? "Tenés 1 turno sin confirmar en las próximas 24hs"
              : `Tenés ${stats.pendingNext24h} turnos sin confirmar en las próximas 24hs`}
          </span>
          <ArrowRight className="ml-auto size-4 shrink-0" />
        </Link>
      )}

      {/* Stat cards */}
      <StatsCards stats={stats} />

      {/* Feature 3: Widget próxima cita */}
      <NextAppointmentCard initial={stats.nextAppointment} />

      {/* Chart */}
      <WeeklyChart data={stats.weeklyChart} />

      {/* Bottom row */}
    </section>
  );
}
