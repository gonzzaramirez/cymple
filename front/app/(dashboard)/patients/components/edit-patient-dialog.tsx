"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sileo } from "sileo";
import { Patient } from "@/lib/types";
import { Pencil } from "lucide-react";

const patientSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  phone: z
    .string()
    .regex(/^\+?\d{8,20}$/, "Formato inválido (ej: +5491123456789)")
    .or(z.literal(""))
    .optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  dni: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormErrors = Partial<Record<keyof z.infer<typeof patientSchema>, string>>;

export function EditPatientDialog({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PatientFormErrors>({});
  const [form, setForm] = useState({
    firstName: patient.firstName,
    lastName: patient.lastName,
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    dni: patient.dni ?? "",
    notes: patient.notes ?? "",
  });

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleClose(next: boolean) {
    if (!next) {
      setFieldErrors({});
      setForm({
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone ?? "",
        email: patient.email ?? "",
        dni: patient.dni ?? "",
        notes: patient.notes ?? "",
      });
    }
    setOpen(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = patientSchema.safeParse(form);
    if (!result.success) {
      const errors: PatientFormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PatientFormErrors;
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const data = result.data;
    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      dni: data.dni?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    };

    const response = await fetch(`/api/backend/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!response.ok) {
      sileo.error({ title: "No se pudo actualizar el paciente" });
      return;
    }

    setOpen(false);
    sileo.success({ title: "Paciente actualizado" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${patient.firstName} ${patient.lastName}`}
          >
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar paciente</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-firstName">Nombre</Label>
              <Input
                id="edit-firstName"
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
              {fieldErrors.firstName && (
                <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-lastName">Apellido</Label>
              <Input
                id="edit-lastName"
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
              {fieldErrors.lastName && (
                <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">
                Teléfono{" "}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="edit-phone"
                type="tel"
                placeholder="+5491123456789"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">
                Email{" "}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-dni">
              DNI{" "}
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="edit-dni"
              value={form.dni}
              onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">
              Notas{" "}
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="edit-notes"
              rows={2}
              placeholder="Alergias, antecedentes, indicaciones especiales..."
              className="resize-none overflow-hidden"
              value={form.notes}
              onInput={(e) => autoResize(e.currentTarget)}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button disabled={loading} type="submit" size="lg">
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
