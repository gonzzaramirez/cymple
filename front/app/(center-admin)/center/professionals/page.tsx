import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { MemberProfessional } from "@/lib/types";
import { ProfessionalsList } from "./components/professionals-list";
import { ProfessionalCreateDialog } from "./components/professional-create-dialog";

export const metadata: Metadata = {
  title: "Profesionales | Centro Médico | Cymple",
};

type Props = {
  searchParams: Promise<{ query?: string; status?: string }>;
};

export default async function ProfessionalsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const qs = new URLSearchParams();
  if (sp.query?.trim()) qs.set("search", sp.query.trim());
  if (sp.status && sp.status !== "all") qs.set("status", sp.status);

  const queryString = qs.toString();
  const endpoint = `organization/professionals${queryString ? `?${queryString}` : ""}`;

  const professionals = await serverApiFetch<MemberProfessional[]>(
    endpoint,
  ).catch(() => [] as MemberProfessional[]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Profesionales
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Administrá los profesionales del centro. Cada profesional puede
            iniciar sesión con sus propias credenciales.
          </p>
        </div>
        <ProfessionalCreateDialog />
      </div>

      <ProfessionalsList
        professionals={professionals}
        initialQuery={sp.query ?? ""}
        initialStatus={sp.status ?? "all"}
      />
    </section>
  );
}
