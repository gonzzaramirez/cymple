import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, Patient } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pacientes | Centro Médico | Cymple",
};

export default async function CenterPatientsPage() {
  const data = await serverApiFetch<ApiList<Patient>>("patients?page=1&limit=20").catch(
    () => null,
  );

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
        <div className="rounded-2xl border border-[var(--border-light)] bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">
            {data.total} pacientes en total
          </p>
          <div className="mt-4 divide-y divide-[var(--border-light)]">
            {data.items.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.lastName}, {p.firstName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.phone ?? p.email ?? "Sin contacto"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No hay pacientes registrados.</p>
      )}
    </section>
  );
}
