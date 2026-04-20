"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { sileo } from "sileo";
import { Plus } from "lucide-react";

export function CreateRevenueDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const payload = {
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
              <Label htmlFor="rev-amount">Monto</Label>
              <Input id="rev-amount" name="amount" type="number" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-date">Fecha</Label>
              <Input id="rev-date" name="occurredAt" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rev-notes">Notas</Label>
            <Input id="rev-notes" name="notes" />
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
