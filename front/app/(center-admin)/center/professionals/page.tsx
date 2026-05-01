import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { MemberProfessional } from "@/lib/types";
import { ProfessionalsList } from "./components/professionals-list";
import { ProfessionalCreateDialog } from "./components/professional-create-dialog";

export const metadata: Metadata = {
  title: "Profesionales | Centro Médico | Cymple",
};

export default async function ProfessionalsPage() {
  const professionals = await serverApiFetch<MemberProfessional[]>(
    "organization/professionals",
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

      <ProfessionalsList professionals={professionals} />
    </section>
  );
}
