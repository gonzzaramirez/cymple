import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientDetail } from "@/app/(dashboard)/patients/[id]/components/patient-detail";
import type { PatientFull, PatientHistory } from "@/lib/types";

export default async function CenterPatientDetailPage({
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
