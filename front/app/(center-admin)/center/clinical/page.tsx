import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import type { ApiList, Patient } from "@/lib/types";
import { ClinicalWorkspace } from "@/components/clinical/clinical-workspace";

export const metadata: Metadata = {
  title: "Clínica | Centro Médico | Cymple",
};

export default async function CenterClinicalPage() {
  const data = await serverApiFetch<ApiList<Patient>>("patients?page=1&limit=200");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Workspace clínico
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Vista centralizada de notas por paciente para todo el centro.
        </p>
      </div>
      <ClinicalWorkspace patients={data.items} basePatientPath="/center/patients" />
    </section>
  );
}
