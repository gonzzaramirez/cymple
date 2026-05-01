import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Finance = {
  income: number;
  expense: number;
  net: number;
  attendedCount: number;
  occupancyPercent: number;
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function CenterFinanceMonthCards({ finance }: { finance: Finance }) {
  const items = [
    { label: "Ingresos", value: currency.format(finance.income), icon: TrendingUp, className: "text-[#34c759]" },
    { label: "Egresos", value: currency.format(finance.expense), icon: TrendingDown, className: "text-destructive" },
    { label: "Neto", value: currency.format(finance.net), icon: DollarSign, className: finance.net >= 0 ? "text-[#34c759]" : "text-destructive" },
  ];

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Finanzas del mes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-[var(--border-light)] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  <Icon className={`size-4 ${item.className}`} />
                  {item.label}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
