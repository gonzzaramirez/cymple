import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSummary } from "@/lib/types";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

export function FinanceSummaryCards({ summary }: { summary: FinanceSummary }) {
  const cards = [
    {
      label: "Ingresos",
      value: `$ ${summary.totals.income.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-[#34c759]",
    },
    {
      label: "Egresos",
      value: `$ ${summary.totals.expense.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: "text-destructive",
    },
    {
      label: "Neto",
      value: `$ ${summary.totals.net.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: summary.totals.net >= 0 ? "text-[#34c759]" : "text-destructive",
    },
    {
      label: "Ocupación",
      value: `${summary.totals.occupancyPercent.toFixed(1)}%`,
      icon: BarChart3,
      color: "text-primary",
    },
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
