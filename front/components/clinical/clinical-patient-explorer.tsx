"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Patient } from "@/lib/types";

type ClinicalPatientExplorerProps = {
  patients: Patient[];
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
};

export function ClinicalPatientExplorer({
  patients,
  selectedPatientId,
  onSelectPatient,
  query,
  onQueryChange,
}: ClinicalPatientExplorerProps) {
  return (
    <aside className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar paciente..."
      />
      <div className="max-h-[65vh] space-y-1 overflow-auto pr-1">
        {patients.map((patient) => {
          const active = patient.id === selectedPatientId;
          return (
            <button
              key={patient.id}
              type="button"
              onClick={() => onSelectPatient(patient.id)}
              className={cn(
                "w-full rounded-xl px-3 py-2 text-left transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-muted/60 text-muted-foreground",
              )}
            >
              <p className="text-sm font-medium">
                {patient.lastName}, {patient.firstName}
              </p>
              <p className="text-xs">{patient.phone || patient.email || "Sin contacto"}</p>
            </button>
          );
        })}
        {patients.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            No hay pacientes para mostrar.
          </p>
        )}
      </div>
    </aside>
  );
}
