import { format } from "date-fns";
import { es } from "date-fns/locale";
import { serverApiFetch } from "@/lib/server-api";
import { StatsCards } from "./components/stats-cards";
import { WeeklyChart } from "./components/weekly-chart";
import { UpcomingAppointments } from "./components/upcoming-appointments";
import { QuickLinks } from "./components/quick-links";

type MeResponse = {
  fullName: string;
};

type DashboardStats = {
  patientsTotal: number;
  patientsThisWeek: number;
  appointmentsThisWeek: number;
  appointmentsToday: number;
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
          <p className="mt-1 text-sm text-muted-foreground">{todayCapitalized}</p>
        </div>
      </div>

      {/* Stat cards */}
      <StatsCards stats={stats} />

      {/* Chart */}
      <WeeklyChart data={stats.weeklyChart} />

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingAppointments appointments={stats.upcomingToday} />
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Accesos rápidos
          </p>
          <QuickLinks />
        </div>
      </div>
    </section>
  );
}
