import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Inicio | Centro Médico | Cymple",
};

type OrgStats = {
  totalProfessionals: number;
  totalPatients: number;
  appointmentsThisWeek: number;
  appointmentsThisMonth: number;
  revenueThisMonth: number;
  professionals: Array<{
    id: string;
    fullName: string;
    specialty: string | null;
    appointmentsThisMonth: number;
  }>;
};

export default async function CenterHomePage() {
  const stats = await serverApiFetch<OrgStats>("dashboard/stats").catch(() => null);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Inicio
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Resumen general del centro médico
        </p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Profesionales activos" value={stats.totalProfessionals} />
            <StatCard label="Pacientes totales" value={stats.totalPatients} />
            <StatCard label="Turnos esta semana" value={stats.appointmentsThisWeek} />
            <StatCard
              label="Ingresos este mes"
              value={`$${stats.revenueThisMonth.toLocaleString("es-AR")}`}
            />
          </div>

          {stats.professionals.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-card p-5 shadow-card">
              <h2 className="mb-4 text-base font-semibold">Profesionales este mes</h2>
              <div className="divide-y divide-[var(--border-light)]">
                {stats.professionals.map((pro) => (
                  <div key={pro.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{pro.fullName}</p>
                      {pro.specialty && (
                        <p className="text-xs text-muted-foreground">{pro.specialty}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {pro.appointmentsThisMonth} turnos
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
