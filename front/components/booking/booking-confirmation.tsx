"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, RotateCcw } from "lucide-react";
import { useMemo } from "react";

export type BookingConfirmationProps = {
  token: string;
  waDeepLink: string;
  expiresAt: string;
  onReset: () => void;
};

function getExpiresText(iso: string): string {
  const now = Date.now();
  const expires = new Date(iso).getTime();
  const diff = Math.max(0, Math.round((expires - now) / 60000));
  if (diff <= 0) return "tu reserva ya expiró";
  if (diff < 60) return `tu reserva expira en ${diff} minutos`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `tu reserva expira en ${hours}h ${mins}min`;
}

export function BookingConfirmation({
  token,
  waDeepLink,
  expiresAt,
  onReset,
}: BookingConfirmationProps) {
  const expiresText = useMemo(
    () => getExpiresText(expiresAt),
    [expiresAt],
  );

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      {/* Checkmark */}
      <div className="inline-flex size-16 items-center justify-center rounded-full bg-[#34c759]/10">
        <CheckCircle2 className="size-8 text-[#34c759]" />
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Reserva creada
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Por favor confirmá tu turno por WhatsApp.
          <br />
          {expiresText}.
        </p>
      </div>

      {/* WA Button */}
      <a
        href={waDeepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full"
      >
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: "#25D366" }}
        >
          <ExternalLink className="size-5" />
          Abrir WhatsApp
        </button>
      </a>

      {/* Token reference */}
      <div className="rounded-lg bg-muted px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Código de reserva:{" "}
          <span className="font-mono font-medium text-foreground">
            {token}
          </span>
        </p>
      </div>

      {/* Check status link */}
      <Link
        href={`/reservar/status?token=${encodeURIComponent(token)}`}
        className="text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        Consultar estado en cualquier momento →
      </Link>

      {/* New booking */}
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
      >
        <RotateCcw className="size-3.5" />
        Nueva reserva
      </button>
    </div>
  );
}
