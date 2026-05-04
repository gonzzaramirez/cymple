"use client";

import { useRouter } from "next/navigation";
import type { MemberProfessional } from "@/lib/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type FinanceScope = "TODOS" | "CENTER" | "PROFESSIONAL";

export function CenterFinanceScopeControls({
  scope,
  professionalId,
  professionals,
}: {
  scope: FinanceScope;
  professionalId?: string;
  professionals: MemberProfessional[];
}) {
  const router = useRouter();

  function navigate(nextScope: FinanceScope, nextProfessionalId?: string) {
    if (nextScope === "TODOS") {
      router.replace("/center/finance");
      return;
    }
    const params = new URLSearchParams({ scope: nextScope });
    if (nextScope === "PROFESSIONAL" && nextProfessionalId) {
      params.set("professionalId", nextProfessionalId);
    }
    router.replace(`/center/finance?${params.toString()}`);
  }

  const scopeLabels: Record<FinanceScope, string> = {
    TODOS: "Todos",
    CENTER: "Centro",
    PROFESSIONAL: "Profesional",
  };

  const scopeDescriptions: Record<FinanceScope, string> = {
    TODOS: "Mostrando todos los movimientos del centro y sus profesionales.",
    CENTER: "Mostrando movimientos imputados al centro completo.",
    PROFESSIONAL: "Mostrando movimientos vinculados al profesional seleccionado.",
  };

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-card p-4 shadow-card">
      <div className="grid gap-4 md:grid-cols-[minmax(180px,240px)_minmax(220px,360px)_1fr] md:items-end">
        <div className="space-y-2">
          <Label>Alcance</Label>
          <Select
            value={scope}
            onValueChange={(value) => {
              const nextScope = value as FinanceScope;
              navigate(
                nextScope,
                nextScope === "PROFESSIONAL"
                  ? professionalId ?? professionals[0]?.id
                  : undefined,
              );
            }}
          >
            <SelectTrigger className="w-full">
              {scopeLabels[scope]}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="CENTER">Centro</SelectItem>
              <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope === "PROFESSIONAL" && (
          <div className="space-y-2">
            <Label>Profesional</Label>
            <Select
              value={professionalId ?? professionals[0]?.id ?? ""}
              onValueChange={(value) => navigate("PROFESSIONAL", value ?? undefined)}
            >
              <SelectTrigger className="w-full" disabled={professionals.length === 0}>
                {professionals.find((p) => p.id === (professionalId ?? professionals[0]?.id))?.fullName ?? "Seleccionar profesional"}
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

        <p className="text-sm leading-6 text-muted-foreground">
          {scopeDescriptions[scope]}
        </p>
      </div>
    </div>
  );
}
