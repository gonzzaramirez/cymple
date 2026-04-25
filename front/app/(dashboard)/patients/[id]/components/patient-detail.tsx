"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
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
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  messageTypeLabel,
  MESSAGE_DIRECTION_LABELS,
} from "@/lib/message-log-labels";
import { cn } from "@/lib/utils";
import { EditPatientDialog } from "../../components/edit-patient-dialog";
import { DeletePatientButton } from "../../components/delete-patient-button";
import {
  CreateAppointmentDialog,
  CreateAppointmentDialogHandle,
} from "../../../appointments/components/create-appointment-dialog";

type PatientFull = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  dni?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

type HistoryAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "ATTENDED" | "ABSENT" | "CANCELLED";
  fee: string;
};

type PatientMessage = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  messageType: string;
  content: string;
  toPhone?: string | null;
  fromPhone?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  appointmentId?: string | null;
};

const statusConfig: Record<
  string,
  { label: string; dot: string }
> = {
  PENDING: { label: "Pendiente", dot: "bg-amber-400" },
  CONFIRMED: { label: "Confirmado", dot: "bg-blue-500" },
  ATTENDED: { label: "Atendido", dot: "bg-emerald-500" },
  ABSENT: { label: "Ausente", dot: "bg-red-400" },
  CANCELLED: { label: "Cancelado", dot: "bg-slate-300" },
};

function messageBadgeVariant(
  messageType: string,
): "default" | "secondary" | "success" | "warning" | "info" {
  switch (messageType) {
    case "APPOINTMENT_CREATED":
      return "info";
    case "APPOINTMENT_REMINDER":
      return "warning";
    case "PATIENT_REPLY":
      return "secondary";
    case "SYSTEM":
      return "success";
    default:
      return "secondary";
  }
}

type PatientDetailProps = {
  patient: PatientFull;
  appointments: HistoryAppointment[];
  summary: { totalSessions: number; totalBilled: number };
  messages: PatientMessage[];
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

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */

export function PatientDetail({
  patient,
  appointments,
  summary,
  messages,
}: PatientDetailProps) {
  const router = useRouter();
  const createApptRef = useRef<CreateAppointmentDialogHandle>(null);

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
                onClick={() => router.push("/patients")}
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
                Notas
              </h3>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {patient.notes || "Sin notas cargadas."}
                </p>
              </div>
            </div>
          </aside>

          {/* Right Column */}
          <main className="space-y-8">
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

            {/* Past Appointments */}
            <section>
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Historial
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Últimos movimientos
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                {past.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    Sin historial
                  </p>
                ) : (
                  past.slice(0, 8).map((a) => (
                    <AppointmentRow key={a.id} appointment={a} isPast />
                  ))
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
                  href={`/messages?patientId=${patient.id}`}
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
          </main>
        </div>
      </div>
    </>
  );
}