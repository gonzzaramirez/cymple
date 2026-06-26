"use client";

import { useState, useRef } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export type BookingFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotDate: string;
  slotStart: string;
  professionalName: string;
  onSubmit: (data: { name: string; phone: string }) => void;
  loading?: boolean;
  error?: string;
};

function formatDateDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimeDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const PHONE_REGEX = /^\d{8,13}$/;

export function BookingFormSheet({
  open,
  onOpenChange,
  slotDate,
  slotStart,
  professionalName,
  onSubmit,
  loading,
  error,
}: BookingFormSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;

    if (!name.trim()) {
      setNameError("El nombre es obligatorio");
      valid = false;
    } else {
      setNameError("");
    }

    const digits = phone.replace(/\D/g, "");
    if (!PHONE_REGEX.test(digits)) {
      setPhoneError("Ingresá un número de teléfono válido (8 a 13 dígitos)");
      valid = false;
    } else {
      setPhoneError("");
    }

    if (!valid) return;

    onSubmit({ name: name.trim(), phone: digits });
  }

  function handlePhoneChange(value: string) {
    // Allow only digits, +, and spaces
    const cleaned = value.replace(/[^\d\s+]/g, "");
    setPhone(cleaned);
    if (phoneError) setPhoneError("");
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-lg font-semibold">
            Confirmar reserva
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Con {professionalName}
          </DrawerDescription>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{formatDateDisplay(slotDate)}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{formatTimeDisplay(slotStart)}</span>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="booking-name">Nombre completo</Label>
            <Input
              ref={nameRef}
              id="booking-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="Tu nombre"
              autoComplete="name"
              disabled={loading}
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-phone">Teléfono (WhatsApp)</Label>
            <Input
              id="booking-phone"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="11 1234 5678"
              inputMode="numeric"
              autoComplete="tel"
              disabled={loading}
              aria-invalid={!!phoneError}
            />
            {phoneError && (
              <p className="text-xs text-destructive">{phoneError}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading}
            style={{ backgroundColor: "#0071e3" }}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Reservando...
              </>
            ) : (
              "Reservar por WhatsApp"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Por favor confirmá tu turno por WhatsApp
          </p>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
