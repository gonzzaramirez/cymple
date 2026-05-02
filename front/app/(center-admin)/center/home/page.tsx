import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { serverApiFetch } from "@/lib/server-api";
import { CenterHomeStatsCards } from "./components/center-home-stats-cards";
import { CenterFinanceMonthCards } from "./components/center-finance-month-cards";
import { CenterProfessionalBreakdown } from "./components/center-professional-breakdown";
import { CenterUpcomingToday } from "./components/center-upcoming-today";
import { CenterWeeklyChartWrapper } from "./components/center-weekly-chart-wrapper";

export const metadata: Metadata = {
  title: "Inicio | Centro Medico | Cymple",
};

type AppointmentStatus = "PENDING" | "CONFIRMED" | "ATTENDED" | "ABSENT" | "CANCELLED";

type CenterAppointment = {
  id: string;
  startAt: string;
  status: Extract<AppointmentStatus, "PENDING" | "CONFIRMED">;
  patient: { id: string; firstName: string; lastName: string };
  professional?: { id: string; fullName: string } | null;
};

type OrgStats = {
  totalProfessionals: number;
  totalPatients: number;
  appointmentsThisWeek: number;
  appointmentsThisMonth: number;
  appointmentsToday?: number;
  pendingNext24h?: number;
  revenueThisMonth: number;
  financeThisMonth: {
    income: number;
    expense: number;
    net: number;
    occupancyPercent: number;
    attendedCount: number;
  };
  upcomingToday?: CenterAppointment[];
  weeklyChart?: Array<{ day: string; total: number; attended: number }>;
  professionals: Array<{
    id: string;
    fullName: string;
    specialty: string | null;
    appointmentsThisMonth: number;
    patientsTotal?: number;
    revenueThisMonth?: number;
  }>;
};

function getFinance(stats: OrgStats) {
  return (
    stats.financeThisMonth ?? {
      income: stats.revenueThisMonth,
      expense: 0,
      net: stats.revenueThisMonth,
      occupancyPercent: 0,
      attendedCount: 0,
    }
  );
}

export default async function CenterHomePage() {
  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  let stats: OrgStats | null = null;
  let error: string | null = null;

  try {
    stats = await serverApiFetch<OrgStats>("dashboard/stats");
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar el resumen";
  }

  if (error) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Inicio
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {todayCapitalized}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No se pudo cargar el resumen del centro medico
          </p>
          <p className="text-xs text-muted-foreground">
            {error}
          </p>
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Inicio
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {todayCapitalized}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No hay datos disponibles
          </p>
          <p className="text-xs text-muted-foreground">
            Complete la configuracion del centro para ver el resumen
          </p>
        </div>
      </section>
    );
  }

  const finance = getFinance(stats);
  const pendingNext24h = stats.pendingNext24h ?? 0;
  const upcomingToday = stats.upcomingToday ?? [];
  const weeklyChart = stats.weeklyChart ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Inicio
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Resumen general del centro medico &mdash; {todayCapitalized}
        </p>
      </div>

      {pendingNext24h > 0 && (
        <Link
          href="/center/appointments"
          className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800 transition-colors hover:bg-yellow-100"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {pendingNext24h === 1
              ? "Hay 1 turno sin confirmar en las proximas 24hs"
              : `Hay ${pendingNext24h} turnos sin confirmar en las proximas 24hs`}
          </span>
          <ArrowRight className="ml-auto size-4 shrink-0" />
        </Link>
      )}

      <CenterHomeStatsCards stats={{ ...stats, financeThisMonth: finance }} />
      <CenterFinanceMonthCards finance={finance} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <CenterWeeklyChartWrapper data={weeklyChart} />
        <CenterUpcomingToday appointments={upcomingToday} />
      </div>

      <CenterProfessionalBreakdown professionals={stats.professionals} />
    </section>
  );
}
