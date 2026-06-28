"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Pencil } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MemberProfessional } from "@/lib/types";

type FormValues = {
  fullName: string;
  phone: string;
  specialty: string;
  consultationMinutes: string;
  bufferMinutes: string;
  standardFee: string;
  publicBookingEnabled: boolean;
  publicBookingSlug: string;
  depositAmount: string;
  depositWindowHours: string;
  paymentAlias: string;
  bookingAutoCancel: boolean;
  bookingAutoCancelHours: string;
  maxActiveBookings: string;
  waPublicBookingPhone: string;
};

type FieldError = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FieldError {
  const errors: FieldError = {};
  if (!values.fullName || values.fullName.length < 2)
    errors.fullName = "Nombre requerido";
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
  if (
    values.publicBookingSlug !== "" &&
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.publicBookingSlug)
  )
    errors.publicBookingSlug = "Formato inválido (solo minúsculas, números y guiones)";
  if (
    values.maxActiveBookings !== "" &&
    (isNaN(Number(values.maxActiveBookings)) || Number(values.maxActiveBookings) < 1)
  )
    errors.maxActiveBookings = "Mínimo 1 turno activo";
  if (
    values.depositAmount !== "" &&
    (isNaN(Number(values.depositAmount)) || Number(values.depositAmount) < 0)
  )
    errors.depositAmount = "El valor debe ser 0 o mayor";
  return errors;
}

type Props = {
  professional: MemberProfessional;
};

export function ProfessionalEditDialog({ professional }: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      fullName: professional.fullName,
      phone: professional.phone ?? "",
      specialty: professional.specialty ?? "",
      consultationMinutes: String(professional.consultationMinutes ?? 30),
      bufferMinutes: String(professional.bufferMinutes ?? 10),
      standardFee: String(Number(professional.standardFee) ?? 0),
      publicBookingEnabled: professional.publicBookingEnabled ?? false,
      publicBookingSlug: professional.publicBookingSlug ?? "",
      depositAmount: professional.depositAmount ? String(Number(professional.depositAmount)) : "",
      depositWindowHours: String(professional.depositWindowHours ?? 24),
      paymentAlias: professional.paymentAlias ?? "",
      bookingAutoCancel: professional.bookingAutoCancel ?? true,
      bookingAutoCancelHours: String(professional.bookingAutoCancelHours ?? 8),
      maxActiveBookings: String(professional.maxActiveBookings ?? 5),
      waPublicBookingPhone: professional.waPublicBookingPhone ?? "",
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
      const res = await fetch(
        `/api/backend/organization/professionals/${professional.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: values.fullName,
            phone: values.phone || undefined,
            specialty: values.specialty || undefined,
            standardFee: values.standardFee ? Number(values.standardFee) : undefined,
            consultationMinutes: values.consultationMinutes
              ? Number(values.consultationMinutes)
              : undefined,
            bufferMinutes: values.bufferMinutes
              ? Number(values.bufferMinutes)
              : undefined,
            publicBookingEnabled: values.publicBookingEnabled,
            publicBookingSlug: values.publicBookingSlug || null,
            depositAmount: values.depositAmount !== ""
              ? Number(values.depositAmount)
              : null,
            depositWindowHours: values.depositWindowHours !== ""
              ? Number(values.depositWindowHours)
              : undefined,
            paymentAlias: values.paymentAlias || null,
            bookingAutoCancel: values.bookingAutoCancel,
            bookingAutoCancelHours: values.bookingAutoCancelHours !== ""
              ? Number(values.bookingAutoCancelHours)
              : undefined,
            maxActiveBookings: values.maxActiveBookings !== ""
              ? Number(values.maxActiveBookings)
              : undefined,
            waPublicBookingPhone: values.waPublicBookingPhone || null,
          }),
        },
      );

      if (!res.ok) {
        const msg = await res.text();
        try {
          const parsed = JSON.parse(msg) as { message?: string };
          setServerError(parsed.message ?? "Error al actualizar");
        } catch {
          setServerError("Error al actualizar");
        }
        return;
      }

      setOpen(false);
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
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5">
            <Pencil className="size-3.5" />
            Editar
          </Button>
        }
      />

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar profesional</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nombre completo *</Label>
            <Input id="fullName" {...register("fullName")} />
            {fieldErrors.fullName && (
              <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" placeholder="+549..." {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="specialty">Especialidad</Label>
              <Input id="specialty" {...register("specialty")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="standardFee">Honorario</Label>
              <Input id="standardFee" type="number" min={0} {...register("standardFee")} />
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
                {...register("consultationMinutes")}
              />
              {fieldErrors.consultationMinutes && (
                <p className="text-sm text-destructive">{fieldErrors.consultationMinutes}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bufferMinutes">Buffer (min)</Label>
              <Input id="bufferMinutes" type="number" min={0} {...register("bufferMinutes")} />
              {fieldErrors.bufferMinutes && (
                <p className="text-sm text-destructive">{fieldErrors.bufferMinutes}</p>
              )}
            </div>
          </div>

          {/* Public Booking Section */}
          <Separator className="my-2" />
          <h3 className="text-sm font-semibold text-foreground">
            Configuración de turnos online
          </h3>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label htmlFor="publicBookingEnabled" className="text-sm font-medium">
                Turnos online habilitados
              </Label>
              <p className="text-xs text-muted-foreground">
                Permitir que pacientes reserven turnos por la web
              </p>
            </div>
            <Switch
              id="publicBookingEnabled"
              {...register("publicBookingEnabled")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="publicBookingSlug">
              Slug de turnos online
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (ej: dr-smith)
              </span>
            </Label>
            <Input id="publicBookingSlug" placeholder="dr-smith" {...register("publicBookingSlug")} />
            {fieldErrors.publicBookingSlug && (
              <p className="text-sm text-destructive">{fieldErrors.publicBookingSlug}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="maxActiveBookings">Turnos activos máximos</Label>
              <Input
                id="maxActiveBookings"
                type="number"
                min={1}
                {...register("maxActiveBookings")}
              />
              {fieldErrors.maxActiveBookings && (
                <p className="text-sm text-destructive">{fieldErrors.maxActiveBookings}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="depositWindowHours">Plazo seña (horas)</Label>
              <Input
                id="depositWindowHours"
                type="number"
                min={0}
                {...register("depositWindowHours")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="depositAmount">Seña requerida ($)</Label>
            <Input
              id="depositAmount"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              {...register("depositAmount")}
            />
            {fieldErrors.depositAmount && (
              <p className="text-sm text-destructive">{fieldErrors.depositAmount}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label htmlFor="bookingAutoCancel" className="text-sm font-medium">
                Cancelación automática
              </Label>
              <p className="text-xs text-muted-foreground">
                Cancelar turnos no confirmados automáticamente
              </p>
            </div>
            <Switch
              id="bookingAutoCancel"
              {...register("bookingAutoCancel")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bookingAutoCancelHours">
              Horas para cancelación automática
            </Label>
            <Input
              id="bookingAutoCancelHours"
              type="number"
              min={0}
              {...register("bookingAutoCancelHours")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paymentAlias">Alias de pago</Label>
            <Input id="paymentAlias" placeholder="alias.mp" {...register("paymentAlias")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="waPublicBookingPhone">
              WhatsApp de turnos online
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (ej: +5491122334455)
              </span>
            </Label>
            <Input
              id="waPublicBookingPhone"
              placeholder="+549..."
              {...register("waPublicBookingPhone")}
            />
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
              {submitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
