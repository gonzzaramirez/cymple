"use client";

import { format, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Revenue = { id: string; amount: string; occurredAt: string; notes?: string | null };
type Expense = { id: string; concept: string; amount: string; occurredAt: string };

export function FinanceChart({
  revenues,
  expenses,
}: {
  revenues: Revenue[];
  expenses: Expense[];
}) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayLabel = format(date, "EEE", { locale: es });

    const dayRevenue = revenues
      .filter((r) => format(new Date(r.occurredAt), "yyyy-MM-dd") === dateStr)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const dayExpense = expenses
      .filter((e) => format(new Date(e.occurredAt), "yyyy-MM-dd") === dateStr)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      name: dayLabel,
      Ingresos: dayRevenue,
      Egresos: dayExpense,
    };
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Esta semana
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#86868b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#86868b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "var(--shadow-card)",
                  fontSize: "13px",
                }}
                formatter={(value) => [`$ ${value}`, undefined]}
              />
              <Legend
                wrapperStyle={{ fontSize: "13px" }}
              />
              <Bar dataKey="Ingresos" fill="#34c759" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Egresos" fill="#ff3b30" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
