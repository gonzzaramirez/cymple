import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { serverApiFetch } from "@/lib/server-api";
import type { Metadata } from "next";
import { AvailabilityConfig } from "@/app/(dashboard)/availability/components/availability-config";
import type { MemberProfessional } from "@/lib/types";

type WeeklyRange = {
  id: string;
  startTime: string;
  endTime: string;
  capacity?: number | null;
  weeklyAvailabilityId: string;
};

type WeeklyDay = {
  id: string;
  weekday: string;
  isEnabled: boolean;
  professionalId: string;
  ranges: WeeklyRange[];
};

type SpecificRange = {
  id: string;
  startTime: string;
  endTime: string;
  capacity?: number | null;
  specificDateAvailabilityId: string;
};

type SlotCapacity = {
  id: string;
  startTime: string;
  capacity: number;
};

type SpecificDate = {
  id: string;
  date: string;
  isEnabled: boolean;
  professionalId: string;
  ranges: SpecificRange[];
  slotCapacities?: SlotCapacity[];
};

export const metadata: Metadata = {
  title: "Disponibilidad del Profesional | Centro Médico | Cymple",
};

export default async function CenterProfessionalAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const professionalId = p.id;

  const [professionals, weekly, specificDates] = await Promise.all([
    serverApiFetch<MemberProfessional[]>("organization/professionals").catch(() => []),
    serverApiFetch<WeeklyDay[]>(`availability/weekly?professionalId=${professionalId}`).catch(() => []),
    serverApiFetch<SpecificDate[]>(`availability/specific-dates?professionalId=${professionalId}`).catch(() => []),
  ]);

  const professional = professionals.find((pro) => pro.id === professionalId);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/center/professionals"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted/40"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            Disponibilidad
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurando el horario de trabajo de {professional?.fullName || "este profesional"}.
          </p>
        </div>
      </div>
      
      <AvailabilityConfig
        key={weekly.map((w) => w.id).join(",") + "|" + specificDates.map((s) => s.id).join(",")}
        weekly={weekly}
        specificDates={specificDates}
        professionalId={professionalId}
      />
    </section>
  );
}
