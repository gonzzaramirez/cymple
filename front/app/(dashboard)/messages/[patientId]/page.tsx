import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { serverApiFetch } from "@/lib/server-api";
import type { Patient, ApiList, MessageLogWithPatient } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PatientMessages } from "./components/patient-messages";

export default async function PatientMessagesPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  let patient: Patient;
  try {
    patient = await serverApiFetch<Patient>(`patients/${patientId}`);
  } catch {
    notFound();
  }

  const data = await serverApiFetch<ApiList<MessageLogWithPatient>>(
    `messages?patientId=${patientId}&limit=100`,
  );

  const messagesByType = new Map<string, typeof data.items>();
  for (const msg of data.items) {
    const group = messagesByType.get(msg.messageType) ?? [];
    group.push(msg);
    messagesByType.set(msg.messageType, group);
  }

  const typeOrder = [
    "APPOINTMENT_CREATED",
    "APPOINTMENT_REMINDER",
    "APPOINTMENT_RESCHEDULED",
    "APPOINTMENT_CANCELLED",
    "PATIENT_REPLY",
    "SYSTEM",
  ];

  const sortedGroups = typeOrder
    .filter((t) => messagesByType.has(t))
    .map((t) => ({ type: t, messages: messagesByType.get(t)! }));

  for (const [t, msgs] of messagesByType) {
    if (!typeOrder.includes(t)) {
      sortedGroups.push({ type: t, messages: msgs });
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/messages"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
            {patient.lastName}, {patient.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} mensaje{data.total === 1 ? "" : "s"} &middot;{" "}
            {patient.phone}
          </p>
        </div>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="py-12 text-center">
          <MessageSquareText className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay mensajes para este paciente.
          </p>
        </div>
      ) : (
        sortedGroups.map((group) => (
          <PatientMessages
            key={group.type}
            type={group.type}
            messages={group.messages}
          />
        ))
      )}
    </section>
  );
}
