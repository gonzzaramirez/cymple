"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MemberProfessional } from "@/lib/types";

type Props = {
  professional: MemberProfessional;
};

export function ProfessionalToggleButton({ professional }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    try {
      await fetch(
        `/api/backend/organization/professionals/${professional.id}`,
        { method: "DELETE" },
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const isActive = professional.isActive;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant={isActive ? "destructive" : "outline"}
            size="sm"
            className="h-8 px-2.5"
            disabled={loading}
          >
            {isActive ? "Desactivar" : "Activar"}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? "Desactivar profesional" : "Activar profesional"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `¿Estás seguro de desactivar a ${professional.fullName}? No podrá iniciar sesión hasta que lo actives nuevamente.`
              : `¿Activar a ${professional.fullName}? Podrá iniciar sesión con sus credenciales.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle}>
            {isActive ? "Desactivar" : "Activar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
