"use client";

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

type WeekDay = { day: string; total: number; attended: number };

export function CenterWeeklyChart({ data }: { data: WeekDay[] }) {
  const hasData = data.some((item) => item.total > 0);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Citas esta semana
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "var(--shadow-card)", fontSize: "13px" }}
                  cursor={{ fill: "rgba(0,0,0,0.04)", radius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }} />
                <Bar dataKey="total" name="Programadas" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="attended" name="Atendidas" fill="#34c759" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[260px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin citas registradas esta semana</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
