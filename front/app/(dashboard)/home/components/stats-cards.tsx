import { Users, CalendarDays, TrendingUp, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DashboardStats = {
  patientsTotal: number;
  patientsThisWeek: number;
  appointmentsThisWeek: number;
  appointmentsToday: number;
  financeThisMonth: {
    income: number;
    net: number;
    occupancyPercent: number;
    attendedCount: number;
  };
};

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "purple" | "orange";
};

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "bg-[#bfdbfe]/70 text-[#1456f0] dark:bg-[#1e3a5f]/80 dark:text-[#93c5fd]",
  green: "bg-[var(--success-bg)] text-[#15803d] dark:bg-green-950/50 dark:text-[#4ade80]",
  purple:
    "bg-gradient-to-br from-[#fce7f3]/90 to-[#bfdbfe]/80 text-[#1456f0] dark:from-purple-950/60 dark:to-[#1e3a5f]/60 dark:text-[#c4b5fd]",
  orange:
    "bg-gradient-to-br from-[#ffedd5] to-[#bfdbfe]/50 text-[#c2410c] dark:from-orange-950/50 dark:to-[#1e3a5f]/40 dark:text-[#fdba74]",
};

function StatCard({ icon, label, value, sub, accent = "blue" }: StatCardProps) {
  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mid text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            {sub && (
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${accentMap[accent]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const income = stats.financeThisMonth.income;
  const incomeFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(income);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        accent="blue"
        icon={<Users className="size-5" />}
        label="Pacientes totales"
        value={stats.patientsTotal}
        sub={
          stats.patientsThisWeek > 0
            ? `+${stats.patientsThisWeek} esta semana`
            : "Sin altas esta semana"
        }
      />
      <StatCard
        accent="purple"
        icon={<UserPlus className="size-5" />}
        label="Nuevos esta semana"
        value={stats.patientsThisWeek}
        sub="Pacientes registrados"
      />
      <StatCard
        accent="orange"
        icon={<CalendarDays className="size-5" />}
        label="Citas esta semana"
        value={stats.appointmentsThisWeek}
        sub={`${stats.appointmentsToday} hoy`}
      />
      <StatCard
        accent="green"
        icon={<TrendingUp className="size-5" />}
        label="Ingresos del mes"
        value={incomeFormatted}
        sub={`${stats.financeThisMonth.occupancyPercent}% ocupación`}
      />
    </div>
  );
}
