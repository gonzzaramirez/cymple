import { AppointmentsView } from "./components/appointments-view";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { ApiList, Appointment } from "@/lib/types";

const DEFAULT_LIST_LIMIT = 20;

export const metadata: Metadata = {
  title: "Agenda | Cymple",
};

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

function buildListQuery(sp: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}): string {
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(sp.limit ?? String(DEFAULT_LIST_LIMIT), 10) || DEFAULT_LIST_LIMIT),
  );
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (sp.search?.trim()) {
    params.set("search", sp.search.trim());
  }
  if (sp.status?.trim()) {
    for (const s of sp.status.split(",").map((x) => x.trim()).filter(Boolean)) {
      params.append("status", s);
    }
  }
  if (sp.from) {
    params.set("from", sp.from);
  }
  if (sp.to) {
    params.set("to", sp.to);
  }
  return params.toString();
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ui?: string;
    view?: string;
    date?: string;
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
  const mode = sp.ui === "list" ? "list" : "calendar";

  if (mode === "list") {
    const listData = await serverApiFetch<ApiList<Appointment>>(
      `appointments?${buildListQuery(sp)}`,
    );
    return (
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Agenda
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Listado con paginación en servidor, búsqueda por paciente (nombre, DNI, teléfono,
            email) y filtros. Cambiá a calendario para la vista semanal.
          </p>
        </div>
        <AppointmentsView
          mode="list"
          listData={listData}
          calendarItems={[]}
          initialDate={initialDate}
        />
      </section>
    );
  }

  const calendarRes = await serverApiFetch<CalendarResponse>(
    `appointments/calendar?${buildCalendarQuery(sp)}`,
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Agenda
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Vistá y gestioná turnos. Usá la lista para buscar en todo el historial y paginar
          resultados.
        </p>
      </div>
      <AppointmentsView
        mode="calendar"
        listData={null}
        calendarItems={calendarRes.items}
        initialDate={initialDate}
      />
    </section>
  );
}
