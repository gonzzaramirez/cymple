"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Calendar,
  CreditCard,
  DollarSign,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Stethoscope,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MESSAGE_DIRECTION_LABELS,
} from "@/lib/message-log-labels";
import { cn } from "@/lib/utils";
import type { ClinicalRecord, PatientFull, HistoryAppointment, PatientMessage } from "@/lib/types";
import { EditPatientDialog } from "../../components/edit-patient-dialog";
import { DeletePatientButton } from "../../components/delete-patient-button";
import {
  CreateAppointmentDialog,
  CreateAppointmentDialogHandle,
} from "../../../appointments/components/create-appointment-dialog";
import { ClinicalRichTextEditor } from "@/components/clinical/clinical-rich-text-editor";
import { sileo } from "sileo";

const statusConfig: Record<string, { label: string; dot: string }> = {
  PENDING: { label: "Pendiente", dot: "bg-amber-400" },
  CONFIRMED: { label: "Confirmado", dot: "bg-blue-500" },
  ATTENDED: { label: "Atendido", dot: "bg-emerald-500" },
  ABSENT: { label: "Ausente", dot: "bg-red-400" },
  CANCELLED: { label: "Cancelado", dot: "bg-slate-300" },
};

type PatientDetailProps = {
  patient: PatientFull;
  appointments: HistoryAppointment[];
  summary: { totalSessions: number; totalBilled: number };
  messages: PatientMessage[];
  clinicalRecords: ClinicalRecord[];
};

function formatShortDateTime(value: string) {
  return format(new Date(value), "EEE dd/MM HH:mm", { locale: es });
}

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function StatItem({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5", accent ?? "text-slate-400")} strokeWidth={2} />
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
      </div>
      <p className="text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-slate-300" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
          {value}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-50"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg p-2.5">
      {content}
    </div>
  );
}

function AppointmentRow({
  appointment,
  isPast = false,
}: {
  appointment: HistoryAppointment;
  isPast?: boolean;
}) {
  const cfg = statusConfig[appointment.status] ?? {
    label: appointment.status,
    dot: "bg-slate-300",
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors",
        isPast ? "hover:bg-slate-50/60" : "hover:bg-slate-50"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            cfg.dot,
            isPast && "opacity-50"
          )}
        />
        <div className="min-w-0">
          <p className={cn(
            "text-sm font-medium truncate",
            isPast ? "text-slate-500" : "text-slate-800"
          )}>
            {formatShortDateTime(appointment.startAt)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {cfg.label}
          </p>
        </div>
      </div>
      <span className={cn(
        "font-mono text-xs shrink-0",
        isPast ? "text-slate-300" : "text-slate-500"
      )}>
        $ {appointment.fee}
      </span>
    </div>
  );
}

function MessageRow({ message }: { message: PatientMessage }) {
  const isInbound = message.direction === "INBOUND";

  return (
    <div
      className={cn(
        "rounded-xl p-3.5 transition-colors",
        isInbound ? "bg-slate-50/70" : "bg-white border border-slate-100"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "size-1.5 rounded-full",
            isInbound ? "bg-blue-400" : "bg-slate-300"
          )} />
          <span className="text-[11px] font-medium text-slate-500">
            {MESSAGE_DIRECTION_LABELS[message.direction] ?? message.direction}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          {format(new Date(message.createdAt), "dd/MM HH:mm", { locale: es })}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-600 line-clamp-2 whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  );
}

const INTAKE_LABELS: Record<string, string> = {
  alcohol: "Alcohol",
  cigarettes: "Cigarrillo",
  drugs: "Drogas",
  coffee: "Café",
  cleaning: "Limpieza",
  exfoliation: "Exfoliación",
  moisturizers: "Hidratantes",
  hydratants: "Hidratación profunda",
  sunProtection: "Protector solar",
  none: "Ninguno",
  nose: "Nariz",
  cheeks: "Mejillas",
  forehead: "Frente",
  erythema: "Eritema",
  irritation: "Irritación",
  cuperosity: "Cuperosis",
  pustules: "Pústulas",
  papules: "Pápulas",
  hyperplasia: "Hiperplasia",
  comedones: "Comedones",
  milium: "Milium",
  hyperpigmentation: "Hiperpigmentación",
  hypopigmentation: "Hipopigmentación",
};

function boolItems(obj: unknown) {
  return Object.entries(obj as Record<string, boolean>).filter(([, v]) => v);
}

function IntakeFormContent({ content }: { content: Record<string, unknown> }) {
  function Section({ title, items }: { title: string; items: [string, boolean][] }) {
    const active = items.filter(([, v]) => v);
    if (active.length === 0) return null;
    return (
      <div className="mt-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {active.map(([key]) => (
            <span key={key} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {INTAKE_LABELS[key] ?? key}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-400">Nombre</p>
          <p className="font-medium text-slate-800">{content.firstName as string} {content.lastName as string}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Edad</p>
          <p className="font-medium text-slate-800">{content.age as string} años</p>
        </div>
      </div>

      {(content.birthDate as string) && (
        <div>
          <p className="text-xs text-slate-400">Fecha de nacimiento</p>
          <p className="font-medium text-slate-800">{format(new Date(content.birthDate as string), "dd/MM/yyyy")}</p>
        </div>
      )}

      {(content.lastTreatmentDate as string) && (
        <div>
          <p className="text-xs text-slate-400">Último tratamiento</p>
          <p className="font-medium text-slate-800">{format(new Date(content.lastTreatmentDate as string), "dd/MM/yyyy")}</p>
        </div>
      )}

      {(content.avoidAreas as string) && (
        <div>
          <p className="text-xs text-slate-400">Zonas a evitar</p>
          <p className="font-medium text-slate-800">{content.avoidAreas as string}</p>
        </div>
      )}

      <Section title="Hábitos" items={boolItems(content.habits).map(([k]) => [k, true] as [string, boolean])} />
      <Section title="Cuidados en casa" items={boolItems(content.homeCare).map(([k]) => [k, true] as [string, boolean])} />
      <Section title="Vasos capilares" items={boolItems(content.visibleCapillaries).map(([k]) => [k, true] as [string, boolean])} />
      <Section title="Condición sebácea" items={boolItems(content.sebaceousCondition).map(([k]) => [k, true] as [string, boolean])} />
      <Section title="Pigmentación" items={boolItems(content.pigmentation).map(([k]) => [k, true] as [string, boolean])} />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */

export function PatientDetail({
  patient,
  appointments,
  summary,
  messages,
  clinicalRecords,
}: PatientDetailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const backUrl = pathname.startsWith("/center/") ? "/center/patients" : "/patients";
  const createApptRef = useRef<CreateAppointmentDialogHandle>(null);
  const [activeGeneralNoteId, setActiveGeneralNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "intake">("history");

  const upcoming = appointments
    .filter((a) => a.status === "PENDING" || a.status === "CONFIRMED")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const past = appointments
    .filter(
      (a) =>
        a.status === "ATTENDED" ||
        a.status === "ABSENT" ||
        a.status === "CANCELLED",
    )
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const latestMessages = messages.slice(0, 6);
  const soapTemplate = useMemo(
    () => ({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "SOAP" }] },
        { type: "paragraph", content: [{ type: "text", text: "S: " }] },
        { type: "paragraph", content: [{ type: "text", text: "O: " }] },
        { type: "paragraph", content: [{ type: "text", text: "A: " }] },
        { type: "paragraph", content: [{ type: "text", text: "P: " }] },
      ],
    }),
    [],
  );
  const physicalExamTemplate = useMemo(
    () => ({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Examen físico" }] },
        { type: "paragraph", content: [{ type: "text", text: "Signos vitales: " }] },
        { type: "paragraph", content: [{ type: "text", text: "Hallazgos: " }] },
        { type: "paragraph", content: [{ type: "text", text: "Plan: " }] },
      ],
    }),
    [],
  );

  const unifiedTimeline = useMemo(() => {
    const appointmentEntries = past.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      date: new Date(appointment.startAt).getTime(),
      type: "appointment" as const,
      appointment,
    }));
    const noteEntries = clinicalRecords.map((record) => ({
      id: `record-${record.id}`,
      date: new Date(record.createdAt).getTime(),
      type: "record" as const,
      record,
    }));
    return [...appointmentEntries, ...noteEntries].sort((a, b) => b.date - a.date);
  }, [past, clinicalRecords]);
  const latestGeneralNote = useMemo(
    () =>
      clinicalRecords.find((record) => record.recordType === "GENERAL_NOTE") ?? null,
    [clinicalRecords],
  );
  const intakeRecord = useMemo(
    () =>
      clinicalRecords.find((record) => record.recordType === "INTAKE_FORM") ?? null,
    [clinicalRecords],
  );

  useEffect(() => {
    if (!latestGeneralNote) return;
    if (activeGeneralNoteId === latestGeneralNote.id) return;
    setActiveGeneralNoteId(latestGeneralNote.id);
  }, [latestGeneralNote, activeGeneralNoteId]);

  return (
    <>
      {/* CSS for micro-animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-section {
          animation: fade-slide-up 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) both;
        }
      `}} />

      <div className="space-y-8 max-w-6xl mx-auto">
        {/* ── Header ── */}
        <div className="animate-section">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Left: Profile Info */}
            <div className="flex items-start gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(backUrl)}
                className="mt-1 shrink-0 text-slate-400 hover:text-slate-600"
              >
                <ArrowLeft className="size-5" />
              </Button>

              <div className="min-w-0 flex-1 pt-0.5">
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 truncate">
                  {patient.lastName}, {patient.firstName}
                </h1>

                {/* Inline Contact */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  {patient.phone && (
                    <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 hover:text-slate-700 transition-colors">
                      <Phone className="size-3.5" strokeWidth={2} />
                      {patient.phone}
                    </a>
                  )}
                  {patient.email && (
                    <a href={`mailto:${patient.email}`} className="flex items-center gap-1.5 hover:text-slate-700 transition-colors">
                      <Mail className="size-3.5" strokeWidth={2} />
                      {patient.email}
                    </a>
                  )}
                  {patient.dni && (
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="size-3.5" strokeWidth={2} />
                      DNI {patient.dni}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <CreateAppointmentDialog
                ref={createApptRef}
                hideTrigger
                onSuccess={() => router.refresh()}
              />
              <Button
                onClick={() =>
                  createApptRef.current?.openWithPatient(
                    patient.id,
                    `${patient.lastName}, ${patient.firstName}`,
                  )
                }
              >
                <Plus className="size-4" />
                Nuevo turno
              </Button>
              <EditPatientDialog patient={patient} />
              <DeletePatientButton
                patientId={patient.id}
                patientName={`${patient.firstName} ${patient.lastName}`}
              />
            </div>
          </div>

          {/* ── Stats Bar ── */}
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-3">
            <StatItem
              label="Sesiones"
              value={summary.totalSessions.toString()}
              icon={Activity}
              accent="text-emerald-500"
            />
            <StatItem
              label="Facturado"
              value={`$ ${summary.totalBilled.toLocaleString("es-AR")}`}
              icon={DollarSign}
            />
            <StatItem
              label="Último turno"
              value={
                appointments[0]
                  ? formatShortDateTime(appointments[0].startAt)
                  : "—"
              }
              icon={Calendar}
            />
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid gap-8 lg:grid-cols-[280px_1fr] animate-section" style={{ animationDelay: "80ms" }}>
          
          {/* Left Column */}
          <aside className="space-y-6">
            {/* Contact Details */}
            <div>
              <h3 className="px-2.5 mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                Contacto
              </h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <InfoRow
                  icon={Phone}
                  label="Teléfono"
                  value={patient.phone || "Sin cargar"}
                  href={patient.phone ? `tel:${patient.phone}` : undefined}
                />
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={patient.email || "Sin cargar"}
                  href={patient.email ? `mailto:${patient.email}` : undefined}
                />
                <InfoRow
                  icon={CreditCard}
                  label="DNI"
                  value={patient.dni || "Sin cargar"}
                />
                <InfoRow
                  icon={Calendar}
                  label="Nacimiento"
                  value={
                    patient.birthDate
                      ? format(new Date(patient.birthDate), "dd/MM/yyyy")
                      : "Sin cargar"
                  }
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="px-2.5 mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                Nota general
              </h3>
              <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <ClinicalRichTextEditor
                  initialContent={latestGeneralNote?.content}
                  placeholder="Antecedentes, alergias, observaciones..."
                  templates={[
                    { id: "soap", label: "Plantilla SOAP", content: soapTemplate },
                    { id: "physical", label: "Examen físico", content: physicalExamTemplate },
                  ]}
                  onSave={async (payload) => {
                    const endpoint = activeGeneralNoteId
                      ? `/api/backend/clinical-records/${activeGeneralNoteId}`
                      : `/api/backend/patients/${patient.id}/clinical-records`;
                    const response = await fetch(endpoint, {
                      method: activeGeneralNoteId ? "PATCH" : "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    if (!response.ok) {
                      sileo.error({ title: "No se pudo guardar la nota general" });
                      throw new Error("save failed");
                    }
                    if (!activeGeneralNoteId) {
                      const created = (await response.json()) as { id: string };
                      setActiveGeneralNoteId(created.id);
                    }
                    router.refresh();
                  }}
                />
              </div>
            </div>
          </aside>

          {/* Right Column */}
          <main className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
              <button
                onClick={() => setActiveTab("history")}
                className={cn(
                  "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  activeTab === "history"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                Historial
              </button>
              <button
                onClick={() => setActiveTab("intake")}
                className={cn(
                  "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  activeTab === "intake"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                Ficha de ingreso
              </button>
            </div>

            {activeTab === "history" ? (
              <>
                {/* Upcoming Appointments */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Próximos turnos
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Requieren atención
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-slate-500"
                      onClick={() =>
                        createApptRef.current?.openWithPatient(
                          patient.id,
                          `${patient.lastName}, ${patient.firstName}`,
                        )
                      }
                    >
                      + Agendar
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                    {upcoming.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">
                        Sin turnos programados
                      </p>
                    ) : (
                      upcoming.slice(0, 4).map((a) => (
                        <AppointmentRow key={a.id} appointment={a} />
                      ))
                    )}
                  </div>
                </section>

                {/* Unified Timeline */}
                <section>
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Timeline clínica
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Turnos + fichas de ingreso + notas
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                    {unifiedTimeline.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">
                        Sin historial
                      </p>
                    ) : (
                      unifiedTimeline.slice(0, 16).map((item) => {
                        if (item.type === "appointment") {
                          return <AppointmentRow key={item.id} appointment={item.appointment} isPast />;
                        }
                        const record = item.record;
                        const isReason = record.recordType === "APPOINTMENT_REASON";
                        const isIntake = record.recordType === "INTAKE_FORM";
                        return (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Stethoscope className="size-4 text-slate-400" />
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {isIntake ? "Ficha de ingreso" : isReason ? "Motivo de turno" : "Nota general"}
                                </p>
                                <Badge variant="secondary">
                                  {isIntake ? "Paciente" : isReason ? "Turno" : "Paciente"}
                                </Badge>
                                {record.appointment?.status === "CANCELLED" && (
                                  <Badge variant="destructive">Turno cancelado</Badge>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {format(new Date(record.createdAt), "dd/MM HH:mm", { locale: es })}
                              </span>
                            </div>
                            {isIntake ? (
                              <IntakeFormContent content={record.content} />
                            ) : (
                              <>
                                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
                                  {record.plainTextPreview || "Sin contenido"}
                                </p>
                                {record.professional && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    {record.professional.fullName}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Messages */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <MessageSquareText className="size-4 text-slate-400" strokeWidth={2} />
                        Mensajes recientes
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        WhatsApp y automatizaciones
                      </p>
                    </div>
                    <Link
                      href={`${pathname.startsWith("/center/") ? "/center" : ""}/messages?patientId=${patient.id}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "text-xs text-slate-500"
                      )}
                    >
                      Ver bandeja
                    </Link>
                  </div>

                  {latestMessages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-400">
                      Sin mensajes registrados
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {latestMessages.map((m) => (
                        <MessageRow key={m.id} message={m} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Ficha de ingreso
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Datos completados por el paciente al reservar
                  </p>
                </div>

                {intakeRecord ? (
                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <span className="text-xs text-slate-400">
                        Completada el {format(new Date(intakeRecord.createdAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <IntakeFormContent content={intakeRecord.content} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-12 text-center">
                    <p className="text-sm text-slate-400">Este paciente aún no completó la ficha de ingreso</p>
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
