"use client";

import { Clock, DollarSign, Wallet } from "lucide-react";
import type { ProfessionalPublic } from "@/lib/api/public-booking";

export type ServiceInfoCardProps = {
  professional: ProfessionalPublic;
};

function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return `$${num.toLocaleString("es-AR")}`;
}

export function ServiceInfoCard({ professional }: ServiceInfoCardProps) {
  const hasFee =
    professional.standardFee !== null &&
    professional.standardFee !== undefined &&
    Number(professional.standardFee) > 0;
  const hasDeposit =
    professional.depositEnabled &&
    professional.depositAmount !== null &&
    professional.depositAmount !== undefined &&
    Number(professional.depositAmount) > 0;

  // Don't render the card if we have nothing meaningful to show
  if (!hasFee && !hasDeposit && !professional.consultationMinutes) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {hasFee && (
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <DollarSign className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Consulta
              </p>
              <p className="text-base font-semibold">
                {formatPrice(professional.standardFee)}
              </p>
            </div>
          </div>
        )}

        {hasDeposit && (
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <Wallet className="size-4 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Seña
              </p>
              <p className="text-base font-semibold">
                {formatPrice(professional.depositAmount)}
              </p>
              {professional.depositWindowHours && (
                <p className="text-[11px] text-muted-foreground">
                  {professional.depositWindowHours}h para enviar comprobante
                </p>
              )}
            </div>
          </div>
        )}

        {professional.consultationMinutes && (
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <Clock className="size-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Duración
              </p>
              <p className="text-base font-semibold">
                {professional.consultationMinutes} min
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
