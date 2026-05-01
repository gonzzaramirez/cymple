import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, MemberProfessional, Patient } from "@/lib/types";
import { CenterPatientsManager } from "./components/center-patients-manager";

export const metadata: Metadata = {
  title: "Pacientes | Centro Médico | Cymple",
};

export default async function CenterPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; query?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1");
  const limit = Number(sp.limit ?? "20");
  const query = sp.query?.trim() ?? "";
  const qs = new URLSearchParams();
  qs.set("page", String(Number.isFinite(page) && page > 0 ? page : 1));
  qs.set("limit", String(Number.isFinite(limit) && limit > 0 ? limit : 20));
  if (query) qs.set("query", query);

  const [data, professionals] = await Promise.all([
    serverApiFetch<ApiList<Patient>>(`patients?${qs.toString()}`).catch(() => null),
    serverApiFetch<MemberProfessional[]>("organization/professionals").catch(() => []),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Pacientes
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Todos los pacientes registrados en el centro.
        </p>
      </div>

      {data ? (
        <CenterPatientsManager
          data={data}
          professionals={professionals.map((p) => ({ id: p.id, fullName: p.fullName, email: p.email }))}
          initialQuery={query}
          limit={limit}
        />
      ) : (
        <p className="text-muted-foreground">No hay pacientes registrados.</p>
      )}
    </section>
  );
}
