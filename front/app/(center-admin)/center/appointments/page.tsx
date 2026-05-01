import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { Appointment, MemberProfessional } from "@/lib/types";
import { CenterScheduleCalendar } from "./components/center-schedule-calendar";
import { CenterCreateAppointmentDialog } from "./components/center-create-appointment-dialog";

export const metadata: Metadata = {
  title: "Agenda | Centro Médico | Cymple",
};

type CalendarLayout = "resource" | "compact";

function buildCalendarQuery(sp: {
  view?: string;
  date?: string;
}): string {
  const params = new URLSearchParams();
  const view =
    sp.view === "day" || sp.view === "month" || sp.view === "week"
      ? sp.view
      : "week";
  params.set("view", view);
  params.set("date", sp.date ?? new Date().toISOString());
  return params.toString();
}

export default async function CenterAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    layout?: string;
    professionalIds?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialDate = sp.date ?? new Date().toISOString();

  const professionals = await serverApiFetch<MemberProfessional[]>(
    "organization/professionals",
  );

  const allProfessionalIds = professionals.map((p) => p.id);
  const calendarWithAll = await serverApiFetch<{ items: Appointment[] }>(
    `appointments/calendar?professionalIds=${allProfessionalIds.join(",")}&${buildCalendarQuery(sp)}`,
  );

  const initialLayout: CalendarLayout =
    sp.layout === "compact" || sp.layout === "resource" ? sp.layout : "resource";

  const initialProfessionalIds = (sp.professionalIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && allProfessionalIds.includes(id));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Agenda del Centro
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Todos los turnos del centro. Usá vistas y filtros para distinguir superposiciones.
          </p>
        </div>
        <CenterCreateAppointmentDialog
          professionals={professionals.map((p) => ({ id: p.id, fullName: p.fullName }))}
        />
      </div>
      <CenterScheduleCalendar
        items={calendarWithAll.items}
        professionals={professionals}
        selectedDate={initialDate}
        initialLayout={initialLayout}
        initialProfessionalIds={initialProfessionalIds}
      />
    </section>
  );
}