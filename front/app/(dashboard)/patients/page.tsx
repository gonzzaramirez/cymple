import { CreatePatientDialog } from "./components/create-patient-dialog";
import type { Metadata } from "next";
import { PatientsDirectory } from "./components/patients-directory";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, Patient } from "@/lib/types";

const DEFAULT_LIMIT = 20;

export const metadata: Metadata = {
  title: "Pacientes | Cymple",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(sp.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const query = (sp.query ?? "").trim();

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (query) qs.set("query", query);

  const data = await serverApiFetch<ApiList<Patient>>(`patients?${qs.toString()}`);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Pacientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Buscá por nombre, DNI, teléfono o email. 
          </p>
        </div>
        <CreatePatientDialog />
      </div>

      <PatientsDirectory data={data} query={query} limit={limit} />
    </section>
  );
}
