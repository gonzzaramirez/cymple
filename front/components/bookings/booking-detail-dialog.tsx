"use client";

import { useState } from "react";
import { sileo } from "sileo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookingDetail,
  STATUS_BADGE_MAP,
  cancelBooking,
  updateBookingNotes,
  markDepositPaid,
  manualConfirmBooking,
} from "@/lib/api/bookings";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Loader2,
  Phone,
  ExternalLink,
  DollarSign,
  XCircle,
  StickyNote,
  CheckCircle2,
  Copy,
  Check,
  UserCheck,
} from "lucide-react";

export type BookingDetailDialogProps = {
  booking: BookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDepositPaid: () => void;
  onCancel: (reason?: string) => void;
  onNotesChange: (notes: string) => void;
  onManualConfirm?: () => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return format(d, "dd/MM/yyyy HH:mm", { locale: es });
}

function formatSlot(booking: BookingDetail): string {
  const datePart = booking.slotDate.slice(0, 10);
  const d = new Date(`${datePart}T${booking.slotStart}:00`);
  const start = booking.slotStart.slice(0, 5);
  const end = booking.slotEnd.slice(0, 5);
  return `${format(d, "EEEE dd/MM/yyyy", { locale: es })} · ${start} a ${end}`;
}

export function BookingDetailDialog({
  booking,
  open,
  onOpenChange,
  onDepositPaid,
  onCancel,
  onNotesChange,
  onManualConfirm,
}: BookingDetailDialogProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [notes, setNotes] = useState(booking.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<"token" | "phone" | null>(
    null,
  );

  async function copyToClipboard(text: string, field: "token" | "phone") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback: select and copy via execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      } catch {
        // give up silently
      }
    }
  }

  const statusCfg = booking.status === "BOOKED" && booking.depositPaidAt
    ? { label: "Pagado", variant: "success" as const }
    : STATUS_BADGE_MAP[booking.status] ?? { label: booking.status, variant: "secondary" as const };

  const canManualConfirm = booking.status === "PENDING_WA_CONFIRMATION";

  const canMarkDeposit =
    booking.status === "BOOKED" || booking.status === "WA_CONTACTED";

  const canCancel =
    booking.status !== "CANCELLED" && booking.status !== "EXPIRED";

  async function handleManualConfirm() {
    setConfirmLoading(true);
    try {
      await manualConfirmBooking(booking.id);
      sileo.success({ title: "Reserva confirmada manualmente" });
      onManualConfirm?.();
    } catch {
      sileo.error({ title: "No se pudo confirmar la reserva" });
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleMarkDepositPaid() {
    setDepositLoading(true);
    try {
      await markDepositPaid(booking.id);
      sileo.success({ title: "Depósito marcado como pagado" });
      onDepositPaid();
    } catch {
      sileo.error({ title: "No se pudo marcar el depósito" });
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleCancelBooking() {
    setCancelLoading(true);
    try {
      await cancelBooking(booking.id, cancelReason || undefined);
      sileo.success({ title: "Reserva cancelada" });
      onCancel(cancelReason || undefined);
      setShowCancelDialog(false);
    } catch {
      sileo.error({ title: "No se pudo cancelar la reserva" });
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await updateBookingNotes(booking.id, notes);
      sileo.success({ title: "Notas guardadas" });
      onNotesChange(notes);
    } catch {
      sileo.error({ title: "No se pudieron guardar las notas" });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold">
              {booking.patientName}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span>
                Código:{" "}
                <span className="font-mono font-medium text-foreground">
                  {booking.token}
                </span>
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(booking.token, "token")}
                className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Copiar código de reserva"
              >
                {copiedField === "token" ? (
                  <Check className="size-3 text-[#34c759]" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              {booking.depositPaidAt && (
                <Badge variant="success">Depósito pagado</Badge>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Teléfono
                </p>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://wa.me/${booking.patientPhone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Phone className="size-3" />
                    {booking.patientPhone}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(booking.patientPhone, "phone")
                    }
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Copiar teléfono"
                  >
                    {copiedField === "phone" ? (
                      <Check className="size-3 text-[#34c759]" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Profesional
                </p>
                <p className="font-medium">{booking.professionalName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Turno
                </p>
                <p className="font-medium">{formatSlot(booking)}</p>
              </div>
              {booking.depositAmount && Number(booking.depositAmount) > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Depósito
                  </p>
                  <p className="font-medium">
                    ${Number(booking.depositAmount).toLocaleString("es-AR")}
                    {booking.depositWindowHours
                      ? ` (ventana de ${booking.depositWindowHours}h)`
                      : ""}
                    {booking.depositPaidAt && (
                      <Badge variant="success" className="ml-2">
                        Pagado
                      </Badge>
                    )}
                    {!booking.depositPaidAt && booking.depositStatus && (
                      <Badge variant="warning" className="ml-2">
                        Pendiente
                      </Badge>
                    )}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Timeline */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Línea de tiempo
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creada</span>
                  <span>{formatDate(booking.createdAt)}</span>
                </div>
                {booking.waContactedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contactado</span>
                    <span>{formatDate(booking.waContactedAt)}</span>
                  </div>
                )}
                {booking.depositPaidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Depósito pagado
                    </span>
                    <span>{formatDate(booking.depositPaidAt)}</span>
                  </div>
                )}
                {booking.cancelledAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cancelado</span>
                    <span>{formatDate(booking.cancelledAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Intake status */}
            {booking.intakeCompleted !== undefined && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                {booking.intakeCompleted ? (
                  <>
                    <CheckCircle2 className="size-4 text-[#34c759]" />
                    <span>Ficha de ingreso completada</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Ficha de ingreso pendiente
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <StickyNote className="size-3" />
                Notas
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={savingNotes || notes === (booking.notes ?? "")}
                >
                  {savingNotes ? (
                    <>
                      <Loader2 className="mr-1 size-3 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar notas"
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {canManualConfirm && (
                <Button
                  variant="default"
                  onClick={handleManualConfirm}
                  disabled={confirmLoading}
                  className="w-full justify-start gap-2"
                >
                  {confirmLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserCheck className="size-4" />
                  )}
                  Confirmar manualmente
                </Button>
              )}

              {canMarkDeposit && (
                <Button
                  variant="outline"
                  onClick={handleMarkDepositPaid}
                  disabled={depositLoading}
                  className="w-full justify-start gap-2"
                >
                  {depositLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <DollarSign className="size-4" />
                  )}
                  Marcar depósito como pagado
                </Button>
              )}

              <a
                href={
                  // Pre-fill WA with a contextual message so the professional
                  // doesn't have to retype the booking details. EncodeURIComponent
                  // handles the date/time and token safely.
                  `https://wa.me/${booking.patientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Hola ${booking.patientName.split(" ")[0]}, te escribimos por tu turno del ${booking.slotDate} ${booking.slotStart}hs. Tu código es ${booking.token}.`,
                  )}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                >
                  <ExternalLink className="size-4" />
                  Abrir WhatsApp
                </Button>
              </a>

              {canCancel && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" />
                  Cancelar reserva
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de cancelar la reserva de{" "}
              <strong>{booking.patientName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej: paciente solicitó cancelación"
              rows={2}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Cancelar reserva"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
