"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { sileo } from "sileo";
import type { MemberProfessional } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type FinanceScope = "CENTER" | "PROFESSIONAL";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function CenterCreateRevenueDialog({
  professionals,
  defaultScope,
  defaultProfessionalId,
}: {
  professionals: MemberProfessional[];
  defaultScope: FinanceScope;
  defaultProfessionalId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<FinanceScope>(defaultScope);
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? professionals[0]?.id ?? "");

  async function onSubmit(formData: FormData) {
    if (scope === "PROFESSIONAL" && !professionalId) {
      sileo.error({ title: "Selecciona un profesional" });
      return;
    }

    setLoading(true);
    const payload = {
      scope,
      professionalId: scope === "PROFESSIONAL" ? professionalId : undefined,
      amount: Number(formData.get("amount")),
      occurredAt: new Date(formData.get("occurredAt") as string).toISOString(),
      notes: formData.get("notes") || undefined,
    };
    const response = await fetch("/api/backend/finance/revenues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!response.ok) {
      sileo.error({ title: "No se pudo guardar el ingreso" });
      return;
    }
    setOpen(false);
    sileo.success({ title: "Ingreso guardado" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Ingreso
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar ingreso</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Alcance</Label>
              <Select value={scope} onValueChange={(value) => setScope(value === "PROFESSIONAL" ? "PROFESSIONAL" : "CENTER")}>
                <SelectTrigger className="w-full">
                  {scope === "CENTER" ? "Centro" : "Profesional"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CENTER">Centro</SelectItem>
                  <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "PROFESSIONAL" && (
              <div className="space-y-2">
                <Label>Profesional</Label>
                <Select value={professionalId} onValueChange={(value) => setProfessionalId(value ?? "")}>
                  <SelectTrigger className="w-full" disabled={professionals.length === 0}>
                    {professionals.find((p) => p.id === professionalId)?.fullName ?? "Seleccionar"}
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="center-rev-amount">Monto</Label>
              <Input id="center-rev-amount" name="amount" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="center-rev-date">Fecha</Label>
              <Input id="center-rev-date" name="occurredAt" type="date" defaultValue={todayInputValue()} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="center-rev-notes">Notas</Label>
            <Input id="center-rev-notes" name="notes" />
          </div>
          <div className="flex justify-end pt-2">
            <Button disabled={loading} type="submit" size="lg">
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
