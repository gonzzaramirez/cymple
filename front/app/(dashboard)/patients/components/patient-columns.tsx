"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Patient } from "@/lib/types";
import { EditPatientDialog } from "./edit-patient-dialog";
import { DeletePatientButton } from "./delete-patient-button";

export const patientColumns: ColumnDef<Patient>[] = [
  {
    accessorKey: "lastName",
    header: "Paciente",
    cell: ({ row }) => (
      <Link
        href={`/patients/${row.original.id}`}
        className="font-medium text-foreground transition-colors hover:text-primary"
      >
        {row.original.lastName}, {row.original.firstName}
      </Link>
    ),
  },
  {
    accessorKey: "phone",
    header: "Teléfono",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.phone}</span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email || "—",
  },
  {
    accessorKey: "dni",
    header: "DNI",
    cell: ({ row }) => row.original.dni || "—",
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
