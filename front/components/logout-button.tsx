"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
      onClick={onLogout}
      aria-label="Cerrar sesión"
    >
      <LogOut className="size-3.5" />
      Salir
    </Button>
  );
}
