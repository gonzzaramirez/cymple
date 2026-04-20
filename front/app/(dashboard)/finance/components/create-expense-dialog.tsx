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
import { Minus } from "lucide-react";

export function CreateExpenseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const payload = {
      concept: formData.get("concept"),
      amount: Number(formData.get("amount")),
      occurredAt: new Date(formData.get("occurredAt") as string).toISOString(),
    };
    const response = await fetch("/api/backend/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!response.ok) {
      sileo.error({ title: "No se pudo guardar el egreso" });
      return;
    }
    setOpen(false);
    sileo.success({ title: "Egreso guardado" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Minus className="size-4" />
            Egreso
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar egreso</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exp-concept">Concepto</Label>
            <Input id="exp-concept" name="concept" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Monto</Label>
              <Input id="exp-amount" name="amount" type="number" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">Fecha</Label>
              <Input id="exp-date" name="occurredAt" type="date" required />
            </div>
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
