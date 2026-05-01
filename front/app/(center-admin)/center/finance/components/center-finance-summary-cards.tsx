import { BarChart3, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FinanceSummary = {
  totals: {
    income: number;
    expense: number;
    net: number;
    attendedCount: number;
    absentCount: number;
    occupancyPercent: number;
  };
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function CenterFinanceSummaryCards({ summary }: { summary: FinanceSummary }) {
  const cards = [
    { label: "Ingresos", value: currency.format(summary.totals.income), icon: TrendingUp, color: "text-[#34c759]" },
    { label: "Egresos", value: currency.format(summary.totals.expense), icon: TrendingDown, color: "text-destructive" },
    { label: "Neto", value: currency.format(summary.totals.net), icon: DollarSign, color: summary.totals.net >= 0 ? "text-[#34c759]" : "text-destructive" },
    { label: "Ocupacion", value: `${summary.totals.occupancyPercent.toFixed(1)}%`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} size="sm" className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <Icon className={`size-4 ${card.color}`} />
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold tracking-[-0.02em]">
                {card.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
