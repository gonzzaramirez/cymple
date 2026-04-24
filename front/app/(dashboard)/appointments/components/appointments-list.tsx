"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpDown } from "lucide-react";
import { DataCard } from "@/components/data-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentActions } from "./appointment-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Appointment } from "@/lib/types";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info" }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  ATTENDED: { label: "Atendido", variant: "success" },
  ABSENT: { label: "Ausente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

export function AppointmentsList({ items }: { items: Appointment[] }) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-12 text-center shadow-card">
        <p className="text-lg text-muted-foreground">No hay turnos esta semana</p>
        <p className="text-sm text-muted-foreground">Creá un turno con el botón de arriba</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((appointment) => {
          const cfg = statusConfig[appointment.status] ?? {
            label: appointment.status,
            variant: "secondary" as const,
          };
          return (
            <DataCard
              key={appointment.id}
              title={
                appointment.patient
                  ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
                  : "Sin paciente"
              }
              items={[
                {
                  label: "Fecha",
                  value: format(new Date(appointment.startAt), "EEE dd/MM HH:mm", { locale: es }),
                },
                { label: "Estado", value: cfg.label },
                { label: "Honorario", value: `$ ${appointment.fee}` },
              ]}
              footer={<AppointmentActions appointment={appointment} />}
            />
          );
        })}
      </div>
    );
  }

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "startAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3"
        >
          Fecha
          <ArrowUpDown className="ml-1 size-3" />
        </Button>
      ),
      cell: ({ row }) =>
        format(new Date(row.original.startAt), "EEE dd/MM HH:mm", { locale: es }),
    },
    {
      accessorKey: "patient",
      header: "Paciente",
      cell: ({ row }) =>
        row.original.patient
          ? `${row.original.patient.lastName}, ${row.original.patient.firstName}`
          : "—",
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const cfg = statusConfig[row.original.status] ?? {
          label: row.original.status,
          variant: "secondary" as const,
        };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
      filterFn: (row, _id, value: string[]) => {
        return value.includes(row.original.status);
      },
    },
    {
      accessorKey: "fee",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3"
        >
          Honorario
          <ArrowUpDown className="ml-1 size-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono">$ {row.original.fee}</span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Motivo",
      cell: ({ row }) => {
        const reason = row.original.reason;
        if (!reason) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className="block max-w-[240px] truncate"
            title={reason}
          >
            {reason}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <AppointmentActions appointment={row.original} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSorting
      enablePagination
      pageSize={15}
    />
  );
}
