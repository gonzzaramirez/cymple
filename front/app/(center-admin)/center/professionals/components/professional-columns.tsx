"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { MemberProfessional } from "@/lib/types";
import { ProfessionalEditDialog } from "./professional-edit-dialog";
import { ProfessionalToggleButton } from "./professional-toggle-button";

export function getProfessionalColumns(): ColumnDef<MemberProfessional>[] {
  return [
    {
      id: "fullName",
      accessorKey: "fullName",
      header: "Nombre",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.fullName}</p>
          {row.original.specialty && (
            <p className="text-xs text-muted-foreground">
              {row.original.specialty}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "email",
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.phone ?? "—"}</span>
      ),
    },
    {
      id: "totalAppointments",
      accessorKey: "totalAppointments",
      header: "Turnos",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.totalAppointments}</span>
      ),
    },
    {
      id: "totalPatients",
      accessorKey: "totalPatients",
      header: "Pacientes",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.totalPatients}</span>
      ),
    },
    {
      id: "isActive",
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <ProfessionalEditDialog professional={row.original} />
          <ProfessionalToggleButton professional={row.original} />
        </div>
      ),
    },
  ];
}
