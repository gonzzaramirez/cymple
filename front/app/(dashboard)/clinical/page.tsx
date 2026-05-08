import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import type { ApiList, Patient } from "@/lib/types";
import { ClinicalWorkspace } from "@/components/clinical/clinical-workspace";

export const metadata: Metadata = {
  title: "Clínica | Cymple",
};

export default async function ClinicalPage() {
  const data = await serverApiFetch<ApiList<Patient>>("patients?page=1&limit=200");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Workspace clínico
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Notas generales y notas por turno en un solo lugar.
        </p>
      </div>
      <ClinicalWorkspace patients={data.items} basePatientPath="/patients" />
    </section>
  );
}
