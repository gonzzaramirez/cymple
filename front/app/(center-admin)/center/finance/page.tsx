import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Finanzas | Centro Médico | Cymple",
};

type FinanceSummary = {
  month: string;
  totals: {
    income: number;
    expense: number;
    net: number;
    attendedCount: number;
    absentCount: number;
    occupancyPercent: number;
  };
};

export default async function CenterFinancePage() {
  const summary = await serverApiFetch<FinanceSummary>("finance/summary").catch(
    () => null,
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Finanzas
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Vista consolidada de ingresos y egresos del centro.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">Ingresos</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-emerald-600">
              ${summary.totals.income.toLocaleString("es-AR")}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">Egresos</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-destructive">
              ${summary.totals.expense.toLocaleString("es-AR")}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">Neto</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">
              ${summary.totals.net.toLocaleString("es-AR")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
