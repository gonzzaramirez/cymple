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
  CalendarClock,
  CreditCard,
  DollarSign,
  Mail,
  MessageSquareText,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  {
    label: string;
    variant: "default" | "secondary" | "success" | "warning" | "destructive" | "info";
  }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  ATTENDED: { label: "Atendido", variant: "success" },
  ABSENT: { label: "Ausente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

type PatientDetailProps = {
  patient: PatientFull;
  appointments: HistoryAppointment[];
  summary: { totalSessions: number; totalBilled: number };
  messages: PatientMessage[];
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

function appointmentStatus(status: string) {
  return statusConfig[status] ?? {
    label: status,
    variant: "secondary" as const,
  };
}

function formatShortDateTime(value: string) {
  return format(new Date(value), "EEE dd/MM HH:mm", { locale: es });
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone?: "default" | "muted" | "success";
}) {
  return (
    <Card size="sm" className="shadow-none ring-1 ring-border/70">
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </p>
          <Icon
            className={cn(
              "size-4",
              tone === "success" ? "text-[#34c759]" : "text-muted-foreground",
            )}
          />
        </div>
        <p
          className={cn(
            "mt-3 font-display text-2xl font-semibold tracking-[-0.02em]",
            tone === "muted" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/35 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function AppointmentRow({
  appointment,
  subdued = false,
}: {
  appointment: HistoryAppointment;
  subdued?: boolean;
}) {
  const cfg = appointmentStatus(appointment.status);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
        subdued ? "hover:bg-muted/35" : "bg-muted/35 hover:bg-muted/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border/70">
          <Calendar className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{formatShortDateTime(appointment.startAt)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(new Date(appointment.startAt), "yyyy", { locale: es })}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="font-mono text-sm text-muted-foreground">
          $ {appointment.fee}
        </span>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: PatientMessage }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={messageBadgeVariant(message.messageType)}>
          {messageTypeLabel(message.messageType)}
        </Badge>
        <Badge variant="outline">
          {MESSAGE_DIRECTION_LABELS[message.direction] ?? message.direction}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(message.createdAt), "dd/MM/yyyy HH:mm", {
            locale: es,
          })}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">
        {message.content}
      </p>
    </div>
  );
}

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

  const absentCount = appointments.filter((a) => a.status === "ABSENT").length;
  const latestAppointment = appointments[0];
  const latestMessages = messages.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/patients")}
              className="mt-1 shrink-0"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="size-5" />
                </div>
                <Badge variant={upcoming.length > 0 ? "info" : "secondary"}>
                  {upcoming.length > 0 ? "Paciente activo" : "Sin turno activo"}
                </Badge>
              </div>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
                {patient.lastName}, {patient.firstName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Ficha operativa con contacto, próximos pasos, actividad y mensajes
                recientes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {patient.phone ? (
                  <Badge variant="outline">
                    <Phone className="size-3" />
                    {patient.phone}
                  </Badge>
                ) : null}
                {patient.email ? (
                  <Badge variant="outline">
                    <Mail className="size-3" />
                    {patient.email}
                  </Badge>
                ) : null}
                {patient.dni ? <Badge variant="secondary">DNI {patient.dni}</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CreateAppointmentDialog
              ref={createApptRef}
              hideTrigger
              onSuccess={() => router.refresh()}
            />
            <Button
              variant="default"
              onClick={() =>
                createApptRef.current?.openWithPatient(
                  patient.id,
                  `${patient.lastName}, ${patient.firstName}`,
                )
              }
            >
              + Nuevo turno
            </Button>
            <EditPatientDialog patient={patient} />
            <DeletePatientButton
              patientId={patient.id}
              patientName={`${patient.firstName} ${patient.lastName}`}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sesiones"
            value={summary.totalSessions.toString()}
            icon={Activity}
            tone="success"
          />
          <MetricCard
            label="Facturado"
            value={`$ ${summary.totalBilled.toLocaleString("es-AR")}`}
            icon={DollarSign}
          />
          <MetricCard
            label="Ausencias"
            value={absentCount.toString()}
            icon={Sparkles}
            tone={absentCount > 0 ? "muted" : "default"}
          />
          <MetricCard
            label="Último turno"
            value={latestAppointment ? formatShortDateTime(latestAppointment.startAt) : "Sin historial"}
            icon={CalendarClock}
            tone="muted"
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.38fr)_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Datos clave</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoLine icon={Phone} label="Teléfono" value={patient.phone || "Sin cargar"} />
              <InfoLine icon={Mail} label="Email" value={patient.email || "Sin cargar"} />
              <InfoLine icon={CreditCard} label="DNI" value={patient.dni || "Sin cargar"} />
              <InfoLine
                icon={Calendar}
                label="Nacimiento"
                value={
                  patient.birthDate
                    ? format(new Date(patient.birthDate), "dd/MM/yyyy")
                    : "Sin cargar"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {patient.notes || "Sin notas cargadas para este paciente."}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-0">
              <div>
                <CardTitle>Próximos turnos</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lo que requiere atención primero.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  createApptRef.current?.openWithPatient(
                    patient.id,
                    `${patient.lastName}, ${patient.firstName}`,
                  )
                }
              >
                Agendar
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="rounded-xl bg-muted/35 p-4 text-center text-sm text-muted-foreground">
                  No hay turnos programados.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming.slice(0, 4).map((appointment) => (
                    <AppointmentRow key={appointment.id} appointment={appointment} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Historial de turnos</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Últimos movimientos, sin cargar toda la ficha visualmente.
              </p>
            </CardHeader>
            <CardContent>
              {past.length === 0 ? (
                <p className="rounded-xl bg-muted/35 p-4 text-center text-sm text-muted-foreground">
                  Sin historial de turnos.
                </p>
              ) : (
                <div className="space-y-2">
                  {past.slice(0, 8).map((appointment) => (
                    <AppointmentRow
                      key={appointment.id}
                      appointment={appointment}
                      subdued
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-4 text-muted-foreground" />
                  Mensajes recientes
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  WhatsApp y automatizaciones vinculadas al paciente.
                </p>
              </div>
              <Link
                href={`/messages?patientId=${patient.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Ver bandeja
              </Link>
            </CardHeader>
            <CardContent>
              {latestMessages.length === 0 ? (
                <p className="rounded-xl bg-muted/35 p-4 text-center text-sm text-muted-foreground">
                  Todavía no hay mensajes registrados para este paciente.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {latestMessages.map((message) => (
                    <MessageRow key={message.id} message={message} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
