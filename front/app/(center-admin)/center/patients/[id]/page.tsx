import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { PatientDetail } from "@/app/(dashboard)/patients/[id]/components/patient-detail";
import type { PatientHistory } from "@/lib/types";

export default async function CenterPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let history: PatientHistory | null = null;

  try {
    history = await serverApiFetch<PatientHistory>(
      `patients/${id}/history`
    );
  } catch {
    notFound();
  }

  if (!history) {
    notFound();
  }

  return (
    <PatientDetail
      patient={history.patient}
      appointments={history.appointments}
      summary={history.summary}
      messages={history.messages}
    />
  );
}
