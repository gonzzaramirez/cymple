"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const CenterWeeklyChart = dynamic(
  () =>
    import("./center-weekly-chart").then((m) => ({
      default: m.CenterWeeklyChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] rounded-2xl" />,
  },
);

function ChartErrorFallback() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 text-center">
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

export function CenterWeeklyChartWrapper({ data }: { data: Array<{ day: string; total: number; attended: number }> }) {
  return (
    <ChartErrorBoundary>
      <CenterWeeklyChart data={data} />
    </ChartErrorBoundary>
  );
}
