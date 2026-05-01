import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { CreateExpenseDialog } from "./components/create-expense-dialog";
import { CreateRevenueDialog } from "./components/create-revenue-dialog";
import { FinanceSummaryCards } from "./components/finance-summary-cards";
import { FinanceTables } from "./components/finance-tables";
import { serverApiFetch } from "@/lib/server-api";
import { FinanceSummary } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

type RevenueList = Array<{
  id: string;
  amount: string;
  occurredAt: string;
  notes?: string | null;
}>;

type ExpenseList = Array<{
  id: string;
  concept: string;
  amount: string;
  occurredAt: string;
}>;

const FinanceChart = dynamic(
  () =>
    import("./components/finance-chart").then((m) => ({
      default: m.FinanceChart,
    })),
  {
    loading: () => <Skeleton className="h-[320px] rounded-2xl" />,
  },
);

export const metadata: Metadata = {
  title: "Finanzas | Cymple",
};

export default async function FinancePage() {
  const [summary, revenues, expenses] = await Promise.all([
    serverApiFetch<FinanceSummary>("finance/summary"),
    serverApiFetch<RevenueList>("finance/revenues?page=1&limit=20"),
    serverApiFetch<ExpenseList>("finance/expenses?page=1&limit=20"),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            Finanzas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance mensual y movimientos
          </p>
        </div>
        <div className="flex gap-2">
          <CreateRevenueDialog />
          <CreateExpenseDialog />
        </div>
      </div>
      <FinanceSummaryCards summary={summary} />
      <FinanceChart revenues={revenues} expenses={expenses} />
      <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
        <FinanceTables revenues={revenues} expenses={expenses} />
      </Suspense>
    </section>
  );
}
