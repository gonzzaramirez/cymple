import { Suspense } from "react";
import { CreatePatientDialog } from "./components/create-patient-dialog";
import { PatientsList } from "./components/patients-list";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default async function PatientsPage() {
  const data = await serverApiFetch<ApiList<Patient>>("patients?page=1&limit=20");
  const withUpcoming = data.items.filter(
    (patient) => patient.summary?.nextAppointment,
  ).length;
  const attendedSessions = data.items.reduce(
    (total, patient) => total + (patient.summary?.totalSessions ?? 0),
    0,
  );
  const absences = data.items.reduce(
    (total, patient) => total + (patient.summary?.absentCount ?? 0),
    0,
  );

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              CRM clínico
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Pacientes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Vista rápida para entender contacto, actividad y próximos pasos sin
              entrar a cada ficha.
            </p>
          </div>
          <CreatePatientDialog />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PatientStat label="Registrados" value={data.total.toString()} />
          <PatientStat label="Con turno activo" value={withUpcoming.toString()} />
          <PatientStat label="Sesiones atendidas" value={attendedSessions.toString()} />
          <PatientStat label="Ausencias" value={absences.toString()} muted />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            Directorio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mostrando {data.items.length} de {data.total} paciente
            {data.total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <PatientsList patients={data.items} />
      </Suspense>
    </section>
  );
}

function PatientStat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Card size="sm" className="shadow-none ring-1 ring-border/70">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-2 font-display text-2xl font-semibold tracking-[-0.02em] ${
            muted ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
