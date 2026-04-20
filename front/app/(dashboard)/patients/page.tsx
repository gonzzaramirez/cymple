import { Suspense } from "react";
import { CreatePatientDialog } from "./components/create-patient-dialog";
import { PatientsList } from "./components/patients-list";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default async function PatientsPage() {
  const data = await serverApiFetch<ApiList<Patient>>("patients?page=1&limit=20");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} paciente{data.total !== 1 ? "s" : ""} registrado{data.total !== 1 ? "s" : ""}
          </p>
        </div>
        <CreatePatientDialog />
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <PatientsList patients={data.items} />
      </Suspense>
    </section>
  );
}
