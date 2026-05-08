"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClinicalRichTextEditor } from "@/components/clinical/clinical-rich-text-editor";
import { sileo } from "sileo";
import type { ClinicalRecord, HistoryAppointment, Patient } from "@/lib/types";

type ClinicalPatientPanelProps = {
  patient: Patient | null;
  records: ClinicalRecord[];
  appointments: HistoryAppointment[];
  basePatientPath: string;
  onRefresh: () => Promise<void>;
};

export function ClinicalPatientPanel({
  patient,
  records,
  appointments,
  basePatientPath,
  onRefresh,
}: ClinicalPatientPanelProps) {
  const [activeGeneralRecordId, setActiveGeneralRecordId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const generalNotes = useMemo(
    () => records.filter((record) => record.recordType === "GENERAL_NOTE"),
    [records],
  );
  const appointmentNotes = useMemo(
    () => records.filter((record) => record.recordType === "APPOINTMENT_REASON"),
    [records],
  );

  const activeGeneralRecord = useMemo(
    () =>
      generalNotes.find((record) => record.id === activeGeneralRecordId) ??
      generalNotes[0] ??
      null,
    [generalNotes, activeGeneralRecordId],
  );

  const activeAppointmentId = selectedAppointmentId ?? appointments[0]?.id ?? null;
  const activeAppointmentRecord = useMemo(
    () =>
      appointmentNotes.find(
        (record) =>
          record.appointmentId &&
          activeAppointmentId &&
          record.appointmentId === activeAppointmentId,
      ) ?? null,
    [appointmentNotes, activeAppointmentId],
  );

  if (!patient) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-muted-foreground">
        Seleccioná un paciente para abrir su workspace clínico.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {patient.lastName}, {patient.firstName}
          </h2>
          <p className="text-sm text-muted-foreground">{patient.phone || patient.email || "Sin contacto"}</p>
        </div>
        <a href={`${basePatientPath}/${patient.id}`} className="text-sm text-primary hover:underline">
          Ver ficha completa
        </a>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Notas generales</TabsTrigger>
          <TabsTrigger value="appointment">Notas por turno</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {generalNotes.map((record) => (
              <Button
                key={record.id}
                type="button"
                variant={record.id === activeGeneralRecord?.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveGeneralRecordId(record.id)}
              >
                {new Date(record.createdAt).toLocaleDateString("es-AR")}
              </Button>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveGeneralRecordId(null)}
            >
              Nueva nota
            </Button>
          </div>

          <ClinicalRichTextEditor
            initialContent={activeGeneralRecord?.content ?? null}
            placeholder="Antecedentes, alergias, observaciones..."
            templates={[
              {
                id: "soap",
                label: "Plantilla SOAP",
                content: {
                  type: "doc",
                  content: [
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "SOAP" }] },
                    { type: "paragraph", content: [{ type: "text", text: "S: " }] },
                    { type: "paragraph", content: [{ type: "text", text: "O: " }] },
                    { type: "paragraph", content: [{ type: "text", text: "A: " }] },
                    { type: "paragraph", content: [{ type: "text", text: "P: " }] },
                  ],
                },
              },
            ]}
            onSave={async (payload) => {
              const endpoint = activeGeneralRecord?.id
                ? `/api/backend/clinical-records/${activeGeneralRecord.id}`
                : `/api/backend/patients/${patient.id}/clinical-records`;
              const response = await fetch(endpoint, {
                method: activeGeneralRecord?.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!response.ok) {
                sileo.error({ title: "No se pudo guardar la nota general" });
                throw new Error("save failed");
              }
              await onRefresh();
            }}
          />
        </TabsContent>

        <TabsContent value="appointment" className="space-y-3">
          <Select
            value={activeAppointmentId ?? ""}
            onValueChange={(value) => setSelectedAppointmentId(value)}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Seleccionar turno" />
            </SelectTrigger>
            <SelectContent>
              {appointments.map((appointment) => (
                <SelectItem key={appointment.id} value={appointment.id}>
                  {new Date(appointment.startAt).toLocaleString("es-AR")} - {appointment.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeAppointmentRecord?.appointment?.status === "CANCELLED" && (
            <Badge variant="destructive">Turno cancelado</Badge>
          )}

          {activeAppointmentId ? (
            <ClinicalRichTextEditor
              initialContent={activeAppointmentRecord?.content ?? null}
              placeholder="Motivo de consulta y evolución del turno..."
              onSave={async (payload) => {
                const response = await fetch(
                  `/api/backend/appointments/${activeAppointmentId}/reason`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  },
                );
                if (!response.ok) {
                  sileo.error({ title: "No se pudo guardar la nota por turno" });
                  throw new Error("save failed");
                }
                await onRefresh();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este paciente no tiene turnos para asociar notas.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
