"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DataCard } from "@/components/data-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Patient } from "@/lib/types";
import { patientColumns } from "./patient-columns";
import { EditPatientDialog } from "./edit-patient-dialog";
import { DeletePatientButton } from "./delete-patient-button";
import { PatientsPagination } from "./patients-pagination";

function formatAppointmentDate(value?: string | null) {
  if (!value) return "Sin registro";
  return format(new Date(value), "EEE dd/MM HH:mm", { locale: es });
}

type PatientsListProps = {
  patients: Patient[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  query: string;
};

export function PatientsList({
  patients,
  page,
  totalPages,
  total,
  limit,
  query,
}: PatientsListProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const pagination = (
    <PatientsPagination
      page={page}
      totalPages={totalPages}
      total={total}
      query={query}
      limit={limit}
    />
  );

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {patients.map((patient) => (
            <DataCard
              key={patient.id}
              eyebrow="Paciente"
              title={
                <Link
                  href={`/patients/${patient.id}`}
                  className="transition-colors hover:text-primary"
                >
                  {patient.lastName}, {patient.firstName}
                </Link>
              }
              description={patient.phone || patient.email || "Sin contacto cargado"}
              meta={
                patient.summary?.nextAppointment ? (
                  <Badge variant="info">Próximo turno</Badge>
                ) : (
                  <Badge variant="secondary">Sin turno</Badge>
                )
              }
              items={[
                {
                  label: "DNI",
                  value: patient.dni || "Sin cargar",
                },
                {
                  label: "Sesiones",
                  value: `${patient.summary?.totalSessions ?? 0} atendidas`,
                },
                {
                  label: "Próximo",
                  value: formatAppointmentDate(
                    patient.summary?.nextAppointment?.startAt,
                  ),
                },
              ]}
              footer={
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/patients/${patient.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Ver ficha
                  </Link>
                  <div className="flex items-center gap-2">
                    <EditPatientDialog patient={patient} />
                    <DeletePatientButton
                      patientId={patient.id}
                      patientName={`${patient.firstName} ${patient.lastName}`}
                    />
                  </div>
                </div>
              }
            />
          ))}
          {patients.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-8 text-center shadow-card">
              <p className="text-muted-foreground">
                {query
                  ? "No hay pacientes que coincidan con la búsqueda"
                  : "No hay pacientes registrados"}
              </p>
            </div>
          )}
        </div>
        {pagination}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-12 text-center shadow-card">
          <p className="text-lg text-muted-foreground">
            {query
              ? "No hay pacientes que coincidan con la búsqueda"
              : "No hay pacientes registrados"}
          </p>
          {!query ? (
            <p className="text-sm text-muted-foreground">
              Creá tu primer paciente con el botón de arriba
            </p>
          ) : null}
        </div>
        {pagination}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={patientColumns}
        data={patients}
        enableSorting
        emptyMessage="Sin datos"
        enablePagination={false}
        onRowClick={(patient) => router.push(`/patients/${patient.id}`)}
      />
      {pagination}
    </div>
  );
}
