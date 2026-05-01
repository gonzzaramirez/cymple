"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpDown, Building2, Monitor } from "lucide-react";
import { ApiList, Appointment } from "@/lib/types";
import { DataCard } from "@/components/data-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type ProfessionalOption = { id: string; fullName?: string | null; email?: string | null };

type Props = {
  data: ApiList<Appointment>;
  professionals: ProfessionalOption[];
};

const statusConfig: Record<
  Appointment["status"],
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

function professionalLabelFromAppointment(appointment: Appointment, professionals: ProfessionalOption[]) {
  const direct = appointment.professional?.fullName?.trim();
  if (direct) return direct;
  const option = professionals.find((professional) => professional.id === appointment.professionalId);
  return option?.fullName?.trim() || option?.email?.trim() || appointment.professionalId;
}

function formatAppointmentDate(value: string) {
  return format(new Date(value), "EEE dd/MM HH:mm", { locale: es });
}

function paginationHref(searchParams: URLSearchParams, page: number, limit: number) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("ui", "list");
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `/center/appointments?${params.toString()}`;
}

export function CenterAppointmentsList({ data, professionals }: Props) {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const hasSearch = Boolean((searchParams.get("search") ?? "").trim());

  const pagination = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Página {data.page} de {data.totalPages} · {data.total} turnos
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={data.page <= 1} render={<Link href={paginationHref(searchParams, Math.max(1, data.page - 1), data.limit)}>Anterior</Link>} />
        <Button variant="outline" disabled={data.page >= data.totalPages} render={<Link href={paginationHref(searchParams, Math.min(data.totalPages, data.page + 1), data.limit)}>Siguiente</Link>} />
      </div>
    </div>
  );

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "startAt",
      header: ({ column }) => (
        <Button variant="ghost" size="xs" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-3">
          Fecha <ArrowUpDown className="ml-1 size-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <p className="font-medium">{formatAppointmentDate(row.original.startAt)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.original.durationMinutes} min</p>
        </div>
      ),
    },
    {
      accessorKey: "patient",
      header: "Paciente",
      cell: ({ row }) => <span className="font-medium">{patientName(row.original)}</span>,
    },
    {
      accessorKey: "professional",
      header: "Profesional",
      cell: ({ row }) => <span className="text-sm">{professionalLabelFromAppointment(row.original, professionals)}</span>,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const cfg = statusConfig[row.original.status] ?? { label: row.original.status, variant: "secondary" as const };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      accessorKey: "fee",
      header: "Detalle",
      cell: ({ row }) => (
        <div className="space-y-1">
          <span className="font-mono text-sm font-medium">$ {row.original.fee}</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {row.original.modality === "VIRTUAL" ? <Monitor className="size-3.5" /> : <Building2 className="size-3.5" />}
            <span>{row.original.modality === "VIRTUAL" ? "Virtual" : "Presencial"}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "reason",
      header: "Motivo",
      cell: ({ row }) => row.original.reason ? <span className="block max-w-[240px] truncate" title={row.original.reason}>{row.original.reason}</span> : <span className="text-muted-foreground">—</span>,
    },
  ];

  if (data.items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center">
          <p className="text-lg text-muted-foreground">
            {hasSearch ? "No hay turnos que coincidan con la búsqueda o filtros" : "No hay turnos para mostrar"}
          </p>
          <p className="text-sm text-muted-foreground">Ajustá búsqueda, fecha, estado o profesional.</p>
        </div>
        {pagination}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {data.items.map((appointment) => {
            const cfg = statusConfig[appointment.status] ?? { label: appointment.status, variant: "secondary" as const };
            return (
              <DataCard
                key={appointment.id}
                eyebrow={formatAppointmentDate(appointment.startAt)}
                title={patientName(appointment)}
                description={appointment.reason || "Sin motivo cargado"}
                meta={<Badge variant={cfg.variant}>{cfg.label}</Badge>}
                items={[
                  { label: "Profesional", value: professionalLabelFromAppointment(appointment, professionals) },
                  { label: "Modalidad", value: appointment.modality === "VIRTUAL" ? "Virtual" : "Presencial" },
                  { label: "Duración", value: `${appointment.durationMinutes} min` },
                  { label: "Honorario", value: `$ ${appointment.fee}` },
                ]}
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
      <DataTable columns={columns} data={data.items} enableSorting enablePagination={false} emptyMessage="No hay datos" />
      {pagination}
    </div>
  );
}
