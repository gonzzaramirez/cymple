"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DataTable } from "@/components/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Revenue = {
  id: string;
  amount: string;
  occurredAt: string;
  notes?: string | null;
};

type Expense = {
  id: string;
  concept: string;
  amount: string;
  occurredAt: string;
};

const revenueColumns: ColumnDef<Revenue>[] = [
  {
    accessorKey: "amount",
    header: "Monto",
    cell: ({ row }) => (
      <span className="font-medium text-[#248a3d]">
        $ {Number(row.original.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    accessorKey: "occurredAt",
    header: "Fecha",
    cell: ({ row }) => format(new Date(row.original.occurredAt), "dd/MM/yyyy"),
  },
  {
    accessorKey: "notes",
    header: "Notas",
    cell: ({ row }) => row.original.notes || "—",
  },
];

const expenseColumns: ColumnDef<Expense>[] = [
  { accessorKey: "concept", header: "Concepto", cell: ({ row }) => <span className="font-medium">{row.original.concept}</span> },
  {
    accessorKey: "amount",
    header: "Monto",
    cell: ({ row }) => (
      <span className="font-medium text-destructive">
        $ {Number(row.original.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    accessorKey: "occurredAt",
    header: "Fecha",
    cell: ({ row }) => format(new Date(row.original.occurredAt), "dd/MM/yyyy"),
  },
];

export function FinanceTables({
  revenues,
  expenses,
}: {
  revenues: Revenue[];
  expenses: Expense[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Ingresos
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {revenues.length} registro{revenues.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={revenueColumns} data={revenues} emptyMessage="Sin ingresos este mes" />
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Egresos
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {expenses.length} registro{expenses.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={expenseColumns} data={expenses} emptyMessage="Sin egresos este mes" />
        </CardContent>
      </Card>
    </div>
  );
}
