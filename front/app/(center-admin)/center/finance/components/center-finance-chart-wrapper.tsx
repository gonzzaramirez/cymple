"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Revenue = { id: string; amount: string; occurredAt: string };
type Expense = { id: string; amount: string; occurredAt: string };

function ChartErrorFallback() {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 text-center">
      <p className="text-sm font-medium text-muted-foreground">No se pudo cargar el gráfico</p>
      <p className="text-xs text-muted-foreground">Actualizá la página para reintentar</p>
    </div>
  );
}

class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <ChartErrorFallback />;
    return this.props.children;
  }
}

export function CenterFinanceChartWrapper({
  revenues,
  expenses,
}: {
  revenues: Revenue[];
  expenses: Expense[];
}) {
  const [ChartComponent, setChartComponent] = useState<
    React.ComponentType<{ revenues: Revenue[]; expenses: Expense[] }> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    import("./center-finance-chart")
      .then((m) => {
        if (!cancelled) setChartComponent(() => m.CenterFinanceChart);
      })
      .catch(() => {
        // silently fail
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ChartComponent) {
    return <Skeleton className="h-[320px] rounded-2xl" />;
  }

  return (
    <ChartErrorBoundary>
      <ChartComponent revenues={revenues} expenses={expenses} />
    </ChartErrorBoundary>
  );
}
