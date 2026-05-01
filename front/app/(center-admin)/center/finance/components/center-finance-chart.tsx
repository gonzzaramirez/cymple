"use client";

import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Revenue = { id: string; amount: string; occurredAt: string };
type Expense = { id: string; amount: string; occurredAt: string };

export function CenterFinanceChart({
  revenues,
  expenses,
}: {
  revenues: Revenue[];
  expenses: Expense[];
}) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = format(date, "yyyy-MM-dd");
    const dayRevenue = revenues
      .filter((item) => format(new Date(item.occurredAt), "yyyy-MM-dd") === dateKey)
      .reduce((total, item) => total + Number(item.amount), 0);
    const dayExpense = expenses
      .filter((item) => format(new Date(item.occurredAt), "yyyy-MM-dd") === dateKey)
      .reduce((total, item) => total + Number(item.amount), 0);

    return {
      name: format(date, "EEE", { locale: es }),
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
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#8e8e93" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `$${value}`} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "var(--shadow-card)", fontSize: "13px" }}
                formatter={(value) => [`$ ${value}`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: "13px" }} />
              <Bar dataKey="Ingresos" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Egresos" fill="#ff3b30" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
