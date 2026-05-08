"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClinicalRecord, HistoryAppointment, Patient } from "@/lib/types";
import { ClinicalPatientExplorer } from "./clinical-patient-explorer";
import { ClinicalPatientPanel } from "./clinical-patient-panel";

type ClinicalWorkspaceProps = {
  patients: Patient[];
  basePatientPath: string;
};

type PatientPayload = {
  records: ClinicalRecord[];
  appointments: HistoryAppointment[];
};

export function ClinicalWorkspace({ patients, basePatientPath }: ClinicalWorkspaceProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    patients[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [cache, setCache] = useState<Record<string, PatientPayload>>({});

  const filteredPatients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((patient) =>
      `${patient.firstName} ${patient.lastName} ${patient.phone ?? ""} ${patient.email ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [patients, query]);

  const selectedPatient =
    filteredPatients.find((patient) => patient.id === selectedPatientId) ?? null;

  const refreshPatientData = async () => {
    if (!selectedPatient) return;
    const [recordsResponse, historyResponse] = await Promise.all([
      fetch(`/api/backend/patients/${selectedPatient.id}/clinical-records?limit=200`),
      fetch(`/api/backend/patients/${selectedPatient.id}/history`),
    ]);
    if (!recordsResponse.ok || !historyResponse.ok) return;
    const [recordsPayload, historyPayload] = (await Promise.all([
      recordsResponse.json(),
      historyResponse.json(),
    ])) as [{ items?: ClinicalRecord[] }, { appointments?: HistoryAppointment[] }];
    setCache((prev) => ({
      ...prev,
      [selectedPatient.id]: {
        records: recordsPayload.items ?? [],
        appointments: historyPayload.appointments ?? [],
      },
    }));
  };

  useEffect(() => {
    const target = selectedPatient;
    if (!target || cache[target.id]) return;
    void refreshPatientData();
  }, [selectedPatient, cache]);

  const selectedPayload = selectedPatient ? cache[selectedPatient.id] : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <ClinicalPatientExplorer
        patients={filteredPatients}
        selectedPatientId={selectedPatient?.id ?? null}
        onSelectPatient={setSelectedPatientId}
        query={query}
        onQueryChange={setQuery}
      />
      <ClinicalPatientPanel
        patient={selectedPatient}
        records={selectedPayload?.records ?? []}
        appointments={selectedPayload?.appointments ?? []}
        basePatientPath={basePatientPath}
        onRefresh={refreshPatientData}
      />
    </div>
  );
}
