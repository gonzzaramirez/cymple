import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientDetail } from "./components/patient-detail";

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

type MessageInHistory = {
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

type PatientHistory = {
  patient: PatientFull;
  appointments: HistoryAppointment[];
  summary: {
    totalSessions: number;
    totalBilled: number;
  };
  messages: MessageInHistory[];
};

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let patient: PatientFull;
  try {
    patient = await serverApiFetch<PatientFull>(`patients/${id}`);
  } catch {
    notFound();
  }

  const history = await serverApiFetch<PatientHistory>(
    `patients/${id}/history`
  );

  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <PatientDetail
        patient={patient}
        appointments={history.appointments}
        summary={history.summary}
        messages={history.messages}
      />
    </Suspense>
  );
}
