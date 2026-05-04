"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Mail, Phone } from "lucide-react";
import { Patient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { EditPatientDialog } from "./edit-patient-dialog";
import { DeletePatientButton } from "./delete-patient-button";

function formatShortDate(value?: string | null) {
  if (!value) return "Sin registro";
  return format(new Date(value), "dd MMM HH:mm", { locale: es });
}

export function getPatientColumns(basePath = "/patients"): ColumnDef<Patient>[] {
  return [
  {
    accessorKey: "lastName",
    header: "Paciente",
    cell: ({ row }) => (
      <div className="min-w-[220px]">
        <Link
          href={`${basePath}/${row.original.id}`}
          className="font-display text-[15px] font-semibold text-foreground transition-colors hover:text-primary"
        >
          {row.original.lastName}, {row.original.firstName}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>DNI {row.original.dni || "sin cargar"}</span>
          <span>Alta {format(new Date(row.original.createdAt), "dd/MM/yy")}</span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Contacto",
    cell: ({ row }) => (
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <Phone className="size-3.5 text-muted-foreground" />
          <span className="font-mono">{row.original.phone || "Sin teléfono"}</span>
        </div>
        {row.original.email ? (
          <div className="flex max-w-[220px] items-center gap-2 text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{row.original.email}</span>
          </div>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "summary",
    header: "Actividad",
    cell: ({ row }) => {
      const summary = row.original.summary;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="info">
              {summary?.totalSessions ?? 0} sesiones
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            <span>Último: {formatShortDate(summary?.lastAppointment?.startAt)}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "nextAppointment",
    header: "Próximo turno",
    cell: ({ row }) => {
      const nextAppointment = row.original.summary?.nextAppointment;
      return nextAppointment ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {formatShortDate(nextAppointment.startAt)}
          </p>
          <Badge variant={nextAppointment.status === "CONFIRMED" ? "info" : "warning"}>
            {nextAppointment.status === "CONFIRMED" ? "Confirmado" : "Pendiente"}
          </Badge>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Sin turnos activos</span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <EditPatientDialog patient={row.original} />
        <DeletePatientButton
          patientId={row.original.id}
          patientName={`${row.original.firstName} ${row.original.lastName}`}
        />
      </div>
    ),
  },
  ];
}
