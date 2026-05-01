import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agenda | Centro Médico | Cymple",
};

export default function CenterAppointmentsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Agenda
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Todos los turnos del centro. Filtrá por profesional.
        </p>
      </div>
      <div className="flex items-center justify-center rounded-2xl border border-[var(--border-light)] bg-card p-12 shadow-card">
        <p className="text-muted-foreground">
          Vista de agenda en construcción
        </p>
      </div>
    </section>
  );
}
