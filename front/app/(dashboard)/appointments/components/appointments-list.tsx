"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpDown, Building2, Monitor } from "lucide-react";
import { DataCard } from "@/components/data-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentActions } from "./appointment-actions";
import { AppointmentsPagination } from "./appointments-pagination";
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

type AppointmentsListProps = {
  items: Appointment[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

export function AppointmentsList({
  items,
  page,
  totalPages,
  total,
  limit,
}: AppointmentsListProps) {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const hasSearch = Boolean((searchParams.get("search") ?? "").trim());

  const pagination = (
    <AppointmentsPagination
      page={page}
      totalPages={totalPages}
      total={total}
      limit={limit}
    />
  );

  const emptyCopy = hasSearch
    ? "No hay turnos que coincidan con la búsqueda o los filtros"
    : "No hay turnos para mostrar";

  const emptyHint = "Ajustá la búsqueda, los filtros o el rango de fechas, o creá un nuevo turno.";

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
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <p className="font-medium">{formatAppointmentDate(row.original.startAt)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.original.durationMinutes} min
          </p>
        </div>
      ),
    },
    {
      accessorKey: "patient",
      header: "Paciente",
      cell: ({ row }) => (
        <div className="min-w-[180px]">
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
            {row.original.modality === "VIRTUAL" ? (
              <>
                <Monitor className="size-3.5 shrink-0" aria-hidden />
                <span>Virtual</span>
              </>
            ) : (
              <>
                <Building2 className="size-3.5 shrink-0" aria-hidden />
                <span>Presencial</span>
              </>
            )}
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

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center">
          <p className="text-lg text-muted-foreground">{emptyCopy}</p>
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        </div>
        {pagination}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
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
                  <div className="flex items-center justify-end gap-3">
                    <AppointmentActions appointment={appointment} />
                  </div>
                }
              />
            );
          })}
        </div>
        {pagination}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={items}
        enableSorting
        enablePagination={false}
        emptyMessage="No hay datos"
      />
      {pagination}
    </div>
  );
}
