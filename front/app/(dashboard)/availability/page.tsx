import { serverApiFetch } from "@/lib/server-api";
import type { Metadata } from "next";
import { AvailabilityConfig } from "./components/availability-config";

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
  title: "Disponibilidad | Cymple",
};

export default async function AvailabilityPage() {
  const [weekly, specificDates] = await Promise.all([
    serverApiFetch<WeeklyDay[]>("availability/weekly").catch(() => []),
    serverApiFetch<SpecificDate[]>("availability/specific-dates").catch(() => []),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          Disponibilidad
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurá tus días y horarios de trabajo
        </p>
      </div>
      <AvailabilityConfig
        key={weekly.map((w) => w.id).join(",") + "|" + specificDates.map((s) => s.id).join(",")}
        weekly={weekly}
        specificDates={specificDates}
      />
    </section>
  );
}
