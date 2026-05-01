import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, Appointment, MemberProfessional } from "@/lib/types";
import { CenterScheduleCalendar } from "./components/center-schedule-calendar";
import { CenterCreateAppointmentDialog } from "./components/center-create-appointment-dialog";

export const metadata: Metadata = {
  title: "Agenda | Centro Médico | Cymple",
};

type CalendarLayout = "resource" | "compact";
const DEFAULT_LIST_LIMIT = 20;

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
    for (const s of sp.status.split(",").map((x) => x.trim()).filter((x) => x && x !== "all")) {
      params.append("status", s);
    }
  }
  if (sp.patientId?.trim()) params.set("patientId", sp.patientId.trim());
  return params.toString();
}

function buildListQuery(sp: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  professionalId?: string;
}): string {
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(sp.limit ?? String(DEFAULT_LIST_LIMIT), 10) || DEFAULT_LIST_LIMIT),
  );
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (sp.search?.trim()) params.set("search", sp.search.trim());
  if (sp.status?.trim()) {
    for (const s of sp.status.split(",").map((x) => x.trim()).filter((x) => x && x !== "all")) {
      params.append("status", s);
    }
  }
  if (sp.from) params.set("from", sp.from);
  if (sp.to) params.set("to", sp.to);
  if (sp.professionalId?.trim() && sp.professionalId.trim() !== "all") params.set("professionalId", sp.professionalId.trim());
  return params.toString();
}

export default async function CenterAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ui?: string;
    view?: string;
    date?: string;
    layout?: string;
    professionalIds?: string;
    professionalId?: string;
    status?: string;
    patientId?: string;
    page?: string;
    limit?: string;
    search?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialDate = sp.date ?? new Date().toISOString();
  const mode = sp.ui === "list" || sp.layout === "list" ? "list" : "calendar";

  const professionals = await serverApiFetch<MemberProfessional[]>(
    "organization/professionals",
  );

  const allProfessionalIds = professionals.map((p) => p.id);
  const initialLayout: CalendarLayout =
    sp.layout === "compact" || sp.layout === "resource" ? sp.layout : "resource";

  const initialProfessionalIds = (sp.professionalIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && allProfessionalIds.includes(id));

  const professionalOptions = professionals.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: p.email,
  }));

  const listData =
    mode === "list"
      ? await serverApiFetch<ApiList<Appointment>>(`appointments?${buildListQuery(sp)}`).catch(() => null)
      : null;

  const calendarWithAll =
    mode === "calendar"
      ? await serverApiFetch<{ items: Appointment[] }>(
          `appointments/calendar?professionalIds=${allProfessionalIds.join(",")}&${buildCalendarQuery(sp)}`,
        )
      : { items: [] };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Agenda del Centro
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Todos los turnos del centro. Usá recursos, compacta o lista para operar sin perder contexto.
          </p>
        </div>
        <CenterCreateAppointmentDialog professionals={professionalOptions} />
      </div>
      <CenterScheduleCalendar
        items={calendarWithAll.items}
        listData={listData}
        professionals={professionalOptions}
        selectedDate={initialDate}
        initialLayout={initialLayout}
        initialMode={mode}
        initialProfessionalIds={initialProfessionalIds}
      />
    </section>
  );
}
