"use client";

import Link from "next/link";
import { DataCard } from "@/components/data-card";
import { DataTable } from "@/components/data-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Patient } from "@/lib/types";
import { patientColumns } from "./patient-columns";
import { EditPatientDialog } from "./edit-patient-dialog";
import { DeletePatientButton } from "./delete-patient-button";

export function PatientsList({ patients }: { patients: Patient[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <DataCard
              title={`${patient.lastName}, ${patient.firstName}`}
              items={[
                { label: "Teléfono", value: patient.phone || "—" },
                { label: "Email", value: patient.email || "—" },
                { label: "DNI", value: patient.dni || "—" },
              ]}
              footer={
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <EditPatientDialog patient={patient} />
                  <DeletePatientButton patientId={patient.id} patientName={`${patient.firstName} ${patient.lastName}`} />
                </div>
              }
            />
          </Link>
        ))}
        {patients.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-card">
            <p className="text-muted-foreground">No hay pacientes registrados</p>
          </div>
        )}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-12 text-center shadow-card">
        <p className="text-lg text-muted-foreground">No hay pacientes registrados</p>
        <p className="text-sm text-muted-foreground">Creá tu primer paciente con el botón de arriba</p>
      </div>
    );
  }

  return <DataTable columns={patientColumns} data={patients} enableSorting enablePagination />;
}
