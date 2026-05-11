"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ClinicalRichTextEditor } from "@/components/clinical/clinical-rich-text-editor";
import { sileo } from "sileo";
import type { ClinicalRecord, HistoryAppointment, Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClinicalPatientPanelProps = {
  patient: Patient | null;
  records: ClinicalRecord[];
  appointments: HistoryAppointment[];
  basePatientPath: string;
  onRefresh: () => Promise<void>;
};

function extractTitleFromContent(content: Record<string, unknown>): string | null {
  const walk = (node: unknown): string | null => {
    if (node == null) return null;
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (record.type === "heading" && record.content) {
        const headingContent = record.content as Array<Record<string, unknown>>;
        const text = headingContent
          .map((c) => (c as Record<string, unknown>).text as string)
          .filter(Boolean)
          .join("");
        if (text) return text;
      }
      if (Array.isArray(record.content)) {
        for (const child of record.content) {
          const result = walk(child);
          if (result) return result;
        }
      }
    }
    return null;
  };
  return walk(content);
}

function NoteCard({
  record,
  isActive,
  onSelect,
  onDelete,
}: {
  record: ClinicalRecord;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const title = record.title || extractTitleFromContent(record.content) || "Sin título";
  const dateStr = format(new Date(record.createdAt), "dd/MM");
  const timeStr = format(new Date(record.createdAt), "HH:mm");

  return (
    <div
      className="group relative flex h-[64px] cursor-pointer overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all duration-300 ease-out hover:border-black/10 hover:shadow-md"
      onClick={onSelect}
    >
      <div className="relative flex h-full flex-1 items-center px-4 transition-transform duration-300 ease-out">
        <div className="flex h-full w-10 shrink-0 items-center justify-center">
          <FileText className="size-5 text-black/20" />
        </div>
        <span className="text-[15px] font-medium text-black/90">{title}</span>
        <div className="ml-auto flex flex-col items-end">
          <span className="text-xs text-black/40">{dateStr}</span>
          <span className="text-[10px] text-black/30">{timeStr}</span>
        </div>
      </div>

      <div className="delete-btn flex h-full w-0 items-center overflow-hidden transition-all duration-300 ease-out group-hover:w-[20%]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-full w-full items-center justify-center rounded-r-xl bg-[#FF3B30] hover:bg-[#E6342A] active:bg-[#D62C1A]"
        >
          <Trash2 className="size-5 text-white" />
        </button>
      </div>
    </div>
  );
}

function NotesList({
  notes,
  activeId,
  onSelect,
  onDelete,
}: {
  notes: ClinicalRecord[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title || "").toLowerCase().includes(q) ||
        n.plainTextPreview.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, ClinicalRecord[]> = {};
    for (const note of filteredNotes) {
      const monthKey = format(new Date(note.createdAt), "MMMM yyyy", { locale: es });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(note);
    }
    return groups;
  }, [filteredNotes]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <FileText className="size-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No hay notas generales</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Agregá una nota para registrar información del paciente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.length > 4 && (
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {notes.length > 8 ? (
        <div className="space-y-4">
          {Object.entries(groupedByMonth).map(([month, monthNotes]) => {
            const isExpanded = expandedMonths.has(month) || expandedMonths.size === 0;
            return (
              <div key={month}>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleMonth(month)}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  <span className="capitalize">{month}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {monthNotes.length}
                  </Badge>
                </button>
                {isExpanded && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {monthNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        record={note}
                        isActive={note.id === activeId}
                        onSelect={() => onSelect(note.id)}
                        onDelete={() => onDelete(note.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              record={note}
              isActive={note.id === activeId}
              onSelect={() => onSelect(note.id)}
              onDelete={() => onDelete(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ClinicalPatientPanel({
  patient,
  records,
  appointments,
  basePatientPath,
  onRefresh,
}: ClinicalPatientPanelProps) {
  const [activeGeneralRecordId, setActiveGeneralRecordId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [isCreatingNoteLoading, setIsCreatingNoteLoading] = useState(false);

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
      generalNotes.find((record) => record.id === activeGeneralRecordId) ?? null,
    [generalNotes, activeGeneralRecordId],
  );

  const activeAppointmentId = selectedAppointmentId ?? appointments[0]?.id ?? null;
  const activeAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) => activeAppointmentId && appointment.id === activeAppointmentId,
      ) ?? null,
    [appointments, activeAppointmentId],
  );
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

  const handleOpenCreateDialog = () => {
    setNoteTitle("");
    setIsCreatingNote(true);
  };

  const handleCreateNote = async () => {
    if (!patient) return;
    setIsCreatingNoteLoading(true);
    try {
      const content = { type: "doc", content: [{ type: "paragraph" }] };

      const response = await fetch(`/api/backend/patients/${patient.id}/clinical-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title: noteTitle.trim() || null,
          plainTextPreview: null,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      sileo.success({ title: "Nota creada" });
      setIsCreatingNote(false);
      await onRefresh();
    } catch {
      sileo.error({ title: "No se pudo crear la nota" });
    } finally {
      setIsCreatingNoteLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      const response = await fetch(`/api/backend/clinical-records/${noteId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("delete failed");
      if (activeGeneralRecordId === noteId) setActiveGeneralRecordId(null);
      sileo.success({ title: "Nota eliminada" });
      await onRefresh();
    } catch {
      sileo.error({ title: "No se pudo eliminar la nota" });
    }
  };

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

        <TabsContent value="general" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {generalNotes.length > 0
                ? `${generalNotes.length} nota${generalNotes.length !== 1 ? "s" : ""}`
                : "Sin notas"}
            </p>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="size-4" />
              Nueva nota
            </Button>
          </div>

          {activeGeneralRecord ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {activeGeneralRecord.title || extractTitleFromContent(activeGeneralRecord.content) || "Nota"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(activeGeneralRecord.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveGeneralRecordId(null)}
                >
                  Cerrar
                </Button>
              </div>
              <ClinicalRichTextEditor
                key={activeGeneralRecord.id}
                initialContent={activeGeneralRecord.content}
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
                  const endpoint = `/api/backend/clinical-records/${activeGeneralRecord.id}`;
                  const response = await fetch(endpoint, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!response.ok) {
                    sileo.error({ title: "No se pudo guardar la nota" });
                    throw new Error("save failed");
                  }
                  await onRefresh();
                }}
              />
            </div>
          ) : (
            <NotesList
              notes={generalNotes}
              activeId={activeGeneralRecordId}
              onSelect={(id) => setActiveGeneralRecordId(id)}
              onDelete={handleDeleteNote}
            />
          )}
        </TabsContent>

        <TabsContent value="appointment" className="space-y-3">
          <Select
            value={activeAppointmentId ?? ""}
            onValueChange={(value) => setSelectedAppointmentId(value)}
          >
            <SelectTrigger className="max-w-md">
              {activeAppointment
                ? `${format(new Date(activeAppointment.startAt), "EEE dd/MM HH:mm", {
                    locale: es,
                  })} · ${activeAppointment.status}`
                : "Seleccionar turno"}
            </SelectTrigger>
            <SelectContent>
              {appointments.map((appointment) => (
                <SelectItem key={appointment.id} value={appointment.id}>
                  {format(new Date(appointment.startAt), "EEE dd/MM HH:mm", {
                    locale: es,
                  })}{" "}
                  · {appointment.status}
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

      <Dialog open={isCreatingNote} onOpenChange={setIsCreatingNote}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nota</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Título (opcional)</label>
            <Input
              placeholder="Ej: Antecedentes familiares"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingNote(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateNote} disabled={isCreatingNoteLoading}>
              {isCreatingNoteLoading ? "Creando..." : "Crear nota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}