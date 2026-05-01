"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import type { MemberProfessional } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FinanceScope = "CENTER" | "PROFESSIONAL";
type ProfessionalRef = { id: string; fullName: string; specialty?: string | null };
type BaseMovement = {
  id: string;
  amount: string;
  occurredAt: string;
  scope?: FinanceScope;
  professionalId?: string | null;
  professional?: ProfessionalRef | null;
};
type Revenue = BaseMovement & { notes?: string | null };
type Expense = BaseMovement & { concept: string };

type MovementFilter = "ALL" | "CENTER" | string;

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function getScopeLabel(item: BaseMovement) {
  return item.scope === "CENTER" || !item.professional ? "Centro" : "Profesional";
}

function getProfessionalName(item: BaseMovement, professionalsById: Map<string, string>) {
  if (item.professional?.fullName) return item.professional.fullName;
  if (item.professionalId) return professionalsById.get(item.professionalId) ?? "Profesional";
  return "-";
}

function matchesMovement(item: BaseMovement, filter: MovementFilter) {
  if (filter === "ALL") return true;
  if (filter === "CENTER") return getScopeLabel(item) === "Centro";
  return item.professionalId === filter || item.professional?.id === filter;
}

export function CenterFinanceTables({
  revenues,
  expenses,
  professionals,
}: {
  revenues: Revenue[];
  expenses: Expense[];
  professionals: MemberProfessional[];
}) {
  const [filter, setFilter] = useState<MovementFilter>("ALL");
  const [search, setSearch] = useState("");
  const professionalsById = useMemo(
    () => new Map(professionals.map((professional) => [professional.id, professional.fullName])),
    [professionals],
  );
  const normalizedSearch = search.trim().toLowerCase();

  const filteredRevenues = useMemo(
    () =>
      revenues.filter((item) => {
        if (!matchesMovement(item, filter)) return false;
        if (!normalizedSearch) return true;
        return [item.notes, getProfessionalName(item, professionalsById), getScopeLabel(item)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      }),
    [filter, normalizedSearch, professionalsById, revenues],
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((item) => {
        if (!matchesMovement(item, filter)) return false;
        if (!normalizedSearch) return true;
        return [item.concept, getProfessionalName(item, professionalsById), getScopeLabel(item)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      }),
    [expenses, filter, normalizedSearch, professionalsById],
  );

  const revenueColumns: ColumnDef<Revenue>[] = useMemo(
    () => [
      {
        accessorKey: "amount",
        header: "Monto",
        cell: ({ row }) => <span className="font-medium text-[#248a3d]">{currency.format(Number(row.original.amount))}</span>,
      },
      {
        accessorKey: "occurredAt",
        header: "Fecha",
        cell: ({ row }) => format(new Date(row.original.occurredAt), "dd/MM/yyyy"),
      },
      {
        id: "scope",
        header: "Alcance",
        cell: ({ row }) => <Badge variant="secondary">{getScopeLabel(row.original)}</Badge>,
      },
      {
        id: "professional",
        header: "Profesional",
        cell: ({ row }) => getProfessionalName(row.original, professionalsById),
      },
      {
        accessorKey: "notes",
        header: "Notas",
        cell: ({ row }) => row.original.notes || "-",
      },
    ],
    [professionalsById],
  );

  const expenseColumns: ColumnDef<Expense>[] = useMemo(
    () => [
      { accessorKey: "concept", header: "Concepto", cell: ({ row }) => <span className="font-medium">{row.original.concept}</span> },
      {
        accessorKey: "amount",
        header: "Monto",
        cell: ({ row }) => <span className="font-medium text-destructive">{currency.format(Number(row.original.amount))}</span>,
      },
      {
        accessorKey: "occurredAt",
        header: "Fecha",
        cell: ({ row }) => format(new Date(row.original.occurredAt), "dd/MM/yyyy"),
      },
      {
        id: "scope",
        header: "Alcance",
        cell: ({ row }) => <Badge variant="secondary">{getScopeLabel(row.original)}</Badge>,
      },
      {
        id: "professional",
        header: "Profesional",
        cell: ({ row }) => getProfessionalName(row.original, professionalsById),
      },
    ],
    [professionalsById],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card md:grid-cols-[240px_1fr] md:items-end">
        <div className="space-y-2">
          <Label>Filtrar por alcance</Label>
          <Select value={filter} onValueChange={(value) => setFilter(value ?? "ALL")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="CENTER">Centro</SelectItem>
              {professionals.map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>
                  {professional.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="finance-search">Buscar</Label>
          <Input
            id="finance-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Concepto, nota o profesional"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Ingresos
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {filteredRevenues.length} registro{filteredRevenues.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={revenueColumns} data={filteredRevenues} emptyMessage="Sin ingresos para el filtro" />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Egresos
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {filteredExpenses.length} registro{filteredExpenses.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={expenseColumns} data={filteredExpenses} emptyMessage="Sin egresos para el filtro" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
