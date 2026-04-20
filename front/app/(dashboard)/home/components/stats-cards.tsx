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
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
};

function StatCard({ icon, label, value, sub, accent = "blue" }: StatCardProps) {
  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-foreground">
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
