import { Suspense } from "react";
import { AppointmentsView } from "./components/appointments-view";
import { serverApiFetch } from "@/lib/server-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Appointment } from "@/lib/types";

type CalendarResponse = {
  items: Appointment[];
};

function buildCalendarQuery(sp: {
  view?: string;
  date?: string;
  status?: string;
  patientId?: string;
}): string {
  const params = new URLSearchParams();
  const view =
    sp.view === "day" || sp.view === "month" || sp.view === "week"
      ? sp.view
      : "week";
  params.set("view", view);
  params.set("date", sp.date ?? new Date().toISOString());
  if (sp.status?.trim()) {
    for (const s of sp.status.split(",").map((x) => x.trim()).filter(Boolean)) {
      params.append("status", s);
    }
  }
  if (sp.patientId?.trim()) {
    params.set("patientId", sp.patientId.trim());
  }
  return params.toString();
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    status?: string;
    patientId?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialDate = sp.date ?? new Date().toISOString();
  const data = await serverApiFetch<CalendarResponse>(
    `appointments/calendar?${buildCalendarQuery(sp)}`,
  );

  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
      <AppointmentsView items={data.items} initialDate={initialDate} />
    </Suspense>
  );
}
