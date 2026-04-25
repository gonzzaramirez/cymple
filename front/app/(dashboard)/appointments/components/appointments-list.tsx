"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpDown, CalendarClock, Monitor, UserRound } from "lucide-react";
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

function patientName(appointment: Appointment) {
  return appointment.patient
    ? `${appointment.patient.lastName}, ${appointment.patient.firstName}`
    : "Sin paciente";
}

function formatAppointmentDate(value: string) {
  return format(new Date(value), "EEE dd/MM HH:mm", { locale: es });
}

export function AppointmentsList({ items }: { items: Appointment[] }) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-12 text-center shadow-card">
        <p className="text-lg text-muted-foreground">No hay turnos para mostrar</p>
        <p className="text-sm text-muted-foreground">
          Ajustá los filtros o creá un nuevo turno.
        </p>
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
              eyebrow={formatAppointmentDate(appointment.startAt)}
              title={
                appointment.patient ? (
                  <Link
                    href={`/patients/${appointment.patient.id}`}
                    className="transition-colors hover:text-primary"
                  >
                    {patientName(appointment)}
                  </Link>
                ) : (
                  patientName(appointment)
                )
              }
              description={appointment.reason || "Sin motivo cargado"}
              meta={<Badge variant={cfg.variant}>{cfg.label}</Badge>}
              items={[
                { label: "Modalidad", value: appointment.modality === "VIRTUAL" ? "Virtual" : "Presencial" },
                { label: "Duración", value: `${appointment.durationMinutes} min` },
                { label: "Honorario", value: `$ ${appointment.fee}` },
              ]}
              footer={
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Buffer {appointment.bufferMinutes} min
                  </span>
                  <AppointmentActions appointment={appointment} />
                </div>
              }
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
        <div className="flex min-w-[150px] items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="size-4" />
          </div>
          <div>
            <p className="font-medium">{formatAppointmentDate(row.original.startAt)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.original.durationMinutes} min + {row.original.bufferMinutes} buffer
            </p>
          </div>
        </div>,
    },
    {
      accessorKey: "patient",
      header: "Paciente",
      cell: ({ row }) => (
        <div className="flex min-w-[190px] items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0">
            {row.original.patient ? (
              <Link
                href={`/patients/${row.original.patient.id}`}
                className="font-medium transition-colors hover:text-primary"
              >
                {patientName(row.original)}
              </Link>
            ) : (
              <span className="text-muted-foreground">Sin paciente</span>
            )}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.patient?.absentCount
                ? `${row.original.patient.absentCount} ausencias`
                : "Sin alertas"}
            </p>
          </div>
        </div>
      ),
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
          Detalle
          <ArrowUpDown className="ml-1 size-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <span className="font-mono text-sm font-medium">$ {row.original.fee}</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Monitor className="size-3.5" />
            <span>
              {row.original.modality === "VIRTUAL" ? "Virtual" : "Presencial"}
            </span>
          </div>
        </div>
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
