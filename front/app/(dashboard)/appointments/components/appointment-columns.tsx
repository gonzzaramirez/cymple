"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Appointment } from "@/lib/types";

export const appointmentColumns: ColumnDef<Appointment>[] = [
  {
    accessorKey: "startAt",
    header: "Fecha",
    cell: ({ row }) =>
      format(new Date(row.original.startAt), "dd/MM/yyyy HH:mm"),
  },
  {
    accessorKey: "patient",
    header: "Paciente",
    cell: ({ row }) =>
      row.original.patient
        ? `${row.original.patient.lastName}, ${row.original.patient.firstName}`
        : row.original.patientId,
  },
  {
    accessorKey: "status",
    header: "Estado",
  },
  {
    accessorKey: "fee",
    header: "Honorario",
    cell: ({ row }) => `$ ${row.original.fee}`,
  },
];
