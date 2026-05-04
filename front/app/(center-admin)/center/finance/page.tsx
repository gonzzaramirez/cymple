import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { serverApiFetch } from "@/lib/server-api";
import type { MemberProfessional } from "@/lib/types";
import { CenterCreateExpenseDialog } from "./components/center-create-expense-dialog";
import { CenterCreateRevenueDialog } from "./components/center-create-revenue-dialog";
import { CenterFinanceScopeControls } from "./components/center-finance-scope-controls";
import { CenterFinanceSummaryCards } from "./components/center-finance-summary-cards";
import { CenterFinanceTables } from "./components/center-finance-tables";
import { CenterFinanceChartWrapper } from "./components/center-finance-chart-wrapper";

export const metadata: Metadata = {
  title: "Finanzas | Centro Medico | Cymple",
};

type FinanceScope = "TODOS" | "CENTER" | "PROFESSIONAL";

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

type ScopedProfessional = {
  id: string;
  fullName: string;
  specialty?: string | null;
};

type RevenueList = Array<{
  id: string;
  amount: string;
  occurredAt: string;
  notes?: string | null;
  scope?: "CENTER" | "PROFESSIONAL";
  professionalId?: string | null;
  professional?: ScopedProfessional | null;
}>;

type ExpenseList = Array<{
  id: string;
  concept: string;
  amount: string;
  occurredAt: string;
  scope?: "CENTER" | "PROFESSIONAL";
  professionalId?: string | null;
  professional?: ScopedProfessional | null;
}>;



function getScope(value?: string): FinanceScope {
  if (value === "PROFESSIONAL") return "PROFESSIONAL";
  if (value === "CENTER") return "CENTER";
  return "TODOS";
}

function buildFinanceQuery(scope: FinanceScope, professionalId?: string) {
  const params = new URLSearchParams({ page: "1", limit: "30" });
  if (scope === "TODOS") return params.toString();
  params.set("scope", scope);
  if (scope === "PROFESSIONAL" && professionalId) {
    params.set("professionalId", professionalId);
  }
  return params.toString();
}

function buildSummaryQuery(scope: FinanceScope, professionalId?: string) {
  if (scope === "TODOS") return "";
  const params = new URLSearchParams({ scope });
  if (scope === "PROFESSIONAL" && professionalId) {
    params.set("professionalId", professionalId);
  }
  return params.toString();
}

export default async function CenterFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; professionalId?: string }>;
}) {
  const sp = await searchParams;
  const scope = getScope(sp.scope);

  const professionals = await serverApiFetch<MemberProfessional[]>(
    "organization/professionals",
  ).catch(() => []);

  const selectedProfessionalId =
    scope === "PROFESSIONAL"
      ? professionals.some((p) => p.id === sp.professionalId)
        ? sp.professionalId
        : professionals[0]?.id
      : undefined;

  const summaryQuery = buildSummaryQuery(scope, selectedProfessionalId);
  const financeQuery = buildFinanceQuery(scope, selectedProfessionalId);

  const [summary, revenues, expenses] = await Promise.all([
    serverApiFetch<FinanceSummary>(
      summaryQuery ? `finance/summary?${summaryQuery}` : "finance/summary",
    ).catch(() => null),
    serverApiFetch<RevenueList>(
      `finance/revenues?${financeQuery}`,
    ).catch(() => []),
    serverApiFetch<ExpenseList>(
      `finance/expenses?${financeQuery}`,
    ).catch(() => []),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Finanzas
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ingresos y egresos del centro, separados por alcance del centro o por profesional.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CenterCreateRevenueDialog
            professionals={professionals}
            defaultScope={scope === "TODOS" ? "CENTER" : scope}
            defaultProfessionalId={selectedProfessionalId}
          />
          <CenterCreateExpenseDialog
            professionals={professionals}
            defaultScope={scope === "TODOS" ? "CENTER" : scope}
            defaultProfessionalId={selectedProfessionalId}
          />
        </div>
      </div>

      <CenterFinanceScopeControls
        scope={scope}
        professionalId={selectedProfessionalId}
        professionals={professionals}
      />

      {summary ? (
        <CenterFinanceSummaryCards summary={summary} />
      ) : (
        <Skeleton className="h-28 rounded-2xl" />
      )}

      <CenterFinanceChartWrapper revenues={revenues} expenses={expenses} />
      <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
        <CenterFinanceTables
          revenues={revenues}
          expenses={expenses}
          professionals={professionals}
        />
      </Suspense>
    </section>
  );
}
