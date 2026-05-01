"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  specialty: string;
  consultationMinutes: string;
  bufferMinutes: string;
  standardFee: string;
};

type FieldError = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FieldError {
  const errors: FieldError = {};
  if (!values.fullName || values.fullName.length < 2)
    errors.fullName = "Nombre requerido";
  if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = "Email inválido";
  if (!values.password || values.password.length < 6)
    errors.password = "Mínimo 6 caracteres";
  if (values.standardFee === "" || isNaN(Number(values.standardFee)) || Number(values.standardFee) < 0)
    errors.standardFee = "Honorario requerido";
  if (
    values.consultationMinutes !== "" &&
    (isNaN(Number(values.consultationMinutes)) || Number(values.consultationMinutes) < 5)
  )
    errors.consultationMinutes = "Mínimo 5 minutos";
  if (
    values.bufferMinutes !== "" &&
    (isNaN(Number(values.bufferMinutes)) || Number(values.bufferMinutes) < 0)
  )
    errors.bufferMinutes = "Valor inválido";
  return errors;
}

export function ProfessionalCreateDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
      specialty: "",
      consultationMinutes: "30",
      bufferMinutes: "10",
      standardFee: "0",
    },
  });

  async function onSubmit(values: FormValues) {
    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/backend/organization/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          phone: values.phone || undefined,
          specialty: values.specialty || undefined,
          standardFee: Number(values.standardFee),
          consultationMinutes: values.consultationMinutes
            ? Number(values.consultationMinutes)
            : undefined,
          bufferMinutes: values.bufferMinutes
            ? Number(values.bufferMinutes)
            : undefined,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        try {
          const parsed = JSON.parse(msg) as { message?: string };
          setServerError(parsed.message ?? "Error al crear profesional");
        } catch {
          setServerError("Error al crear profesional");
        }
        return;
      }

      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setServerError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 rounded-full">
            <Plus className="size-4" />
            Nuevo profesional
          </Button>
        }
      />

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo profesional</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nombre completo *</Label>
            <Input id="fullName" placeholder="Dra. García" {...register("fullName")} />
            {fieldErrors.fullName && (
              <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="dra.garcia@clinica.com"
              {...register("email")}
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              {...register("password")}
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" placeholder="+549..." {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="specialty">Especialidad</Label>
              <Input id="specialty" placeholder="Clínica médica" {...register("specialty")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="standardFee">Honorario *</Label>
              <Input
                id="standardFee"
                type="number"
                min={0}
                placeholder="8000"
                {...register("standardFee")}
              />
              {fieldErrors.standardFee && (
                <p className="text-sm text-destructive">{fieldErrors.standardFee}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consultationMinutes">Duración (min)</Label>
              <Input
                id="consultationMinutes"
                type="number"
                min={5}
                placeholder="30"
                {...register("consultationMinutes")}
              />
              {fieldErrors.consultationMinutes && (
                <p className="text-sm text-destructive">{fieldErrors.consultationMinutes}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bufferMinutes">Buffer (min)</Label>
              <Input
                id="bufferMinutes"
                type="number"
                min={0}
                placeholder="10"
                {...register("bufferMinutes")}
              />
              {fieldErrors.bufferMinutes && (
                <p className="text-sm text-destructive">{fieldErrors.bufferMinutes}</p>
              )}
            </div>
          </div>

          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando..." : "Crear profesional"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
