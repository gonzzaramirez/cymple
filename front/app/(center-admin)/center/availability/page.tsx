import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, UserCircle } from "lucide-react";
import { serverApiFetch } from "@/lib/server-api";
import type { MemberProfessional } from "@/lib/types";

export const metadata: Metadata = {
  title: "Disponibilidad | Centro Médico | Cymple",
};

export default async function CenterAvailabilityPage() {
  const professionals = await serverApiFetch<MemberProfessional[]>(
    "organization/professionals"
  ).catch(() => [] as MemberProfessional[]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Disponibilidad horaria
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Configurá los horarios de atención de cada profesional del centro.
        </p>
      </div>

      {professionals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-10 text-center">
          <Clock className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No hay profesionales activos en el centro.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((pro) => (
            <Link
              key={pro.id}
              href={`/center/professionals/${pro.id}/availability`}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card transition-all hover:shadow-card-hover hover:border-primary/30"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8f0fb] ring-1 ring-[#0071e3]/20">
                <UserCircle className="size-6 text-[#0071e3]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {pro.fullName}
                </p>
                {pro.specialty && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {pro.specialty}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                  <Clock className="size-3" />
                  Editar horarios
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
