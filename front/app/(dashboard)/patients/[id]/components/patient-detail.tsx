"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  DollarSign,
  Activity,
  MessageSquareText,
} from "lucide-react";
import {
  messageTypeLabel,
  MESSAGE_DIRECTION_LABELS,
} from "@/lib/message-log-labels";
import { cn } from "@/lib/utils";
import { EditPatientDialog } from "../../components/edit-patient-dialog";
import { DeletePatientButton } from "../../components/delete-patient-button";
import { CreateAppointmentDialog, CreateAppointmentDialogHandle } from "../../../appointments/components/create-appointment-dialog";

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
        a.status === "CANCELLED"
    )
    .sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/patients")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            {patient.lastName}, {patient.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ficha de paciente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EditPatientDialog patient={patient} />
          <DeletePatientButton
            patientId={patient.id}
            patientName={`${patient.firstName} ${patient.lastName}`}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {patient.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="size-4 text-muted-foreground" />
                <span className="font-mono text-sm">{patient.phone}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 text-muted-foreground" />
                <span className="text-sm">{patient.email}</span>
              </div>
            )}
            {patient.dni && (
              <div className="flex items-center gap-2.5">
                <CreditCard className="size-4 text-muted-foreground" />
                <span className="text-sm">{patient.dni}</span>
              </div>
            )}
            {patient.birthDate && (
              <div className="flex items-center gap-2.5">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(patient.birthDate), "dd/MM/yyyy")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Resumen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[#34c759]" />
                <span className="text-sm text-muted-foreground">Sesiones</span>
              </div>
              <span className="text-lg font-semibold">
                {summary.totalSessions}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Total facturado
                </span>
              </div>
              <span className="text-lg font-mono font-semibold">
                $ {summary.totalBilled.toLocaleString("es-AR")}
              </span>
            </div>
          </CardContent>
        </Card>

        {patient.notes && (
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Próximos turnos
          </CardTitle>
          {/* Diálogo oculto (sin trigger propio): se abre con openWithPatient */}
          <CreateAppointmentDialog
            ref={createApptRef}
            hideTrigger
            onSuccess={() => router.refresh()}
          />
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
            + Nuevo turno
          </Button>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay turnos programados
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((appt) => {
                const cfg = statusConfig[appt.status] ?? {
                  label: appt.status,
                  variant: "secondary" as const,
                };
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(appt.startAt), "EEE dd/MM HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">
                        $ {appt.fee}
                      </span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            <MessageSquareText className="size-4" />
            Mensajes (WhatsApp)
          </CardTitle>
          <Link
            href={`/messages?patientId=${patient.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ver en bandeja global
          </Link>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ?
            <p className="py-4 text-center text-sm text-muted-foreground">
              Todavía no hay mensajes registrados para este paciente.
            </p>
          : <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border/50 bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={messageBadgeVariant(m.messageType)}>
                      {messageTypeLabel(m.messageType)}
                    </Badge>
                    <Badge variant="outline">
                      {MESSAGE_DIRECTION_LABELS[m.direction] ?? m.direction}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: es,
                      })}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Historial de turnos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Sin historial de turnos
            </p>
          ) : (
            <div className="space-y-2">
              {past.map((appt) => {
                const cfg = statusConfig[appt.status] ?? {
                  label: appt.status,
                  variant: "secondary" as const,
                };
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="size-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(appt.startAt), "EEE dd/MM/yyyy HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">
                        $ {appt.fee}
                      </span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
