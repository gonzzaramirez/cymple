"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  MessageSquareText,
  Calendar,
  DollarSign,
  Clock,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoutButton } from "@/components/logout-button";

const baseNavItems = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/messages", label: "Mensajes", icon: MessageSquareText },
  { href: "/appointments", label: "Agenda", icon: Calendar, badgeKey: "appointments" as const },
  { href: "/finance", label: "Finanzas", icon: DollarSign },
  { href: "/availability", label: "Disponibilidad", icon: Clock },
  { href: "/settings", label: "Configuración", icon: Settings },
];

type AppSidebarProps = {
  professionalName: string;
  pendingNext24h?: number;
};

export function AppSidebar({ professionalName, pendingNext24h: initialPending = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [pendingCount, setPendingCount] = useState(initialPending);

  // Refresh pending count every 2 minutes
  useEffect(() => {
    async function fetchPending() {
      try {
        const res = await fetch("/api/backend/dashboard/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setPendingCount(data.pendingNext24h ?? 0);
      } catch {
        // silently ignore
      }
    }

    fetchPending();
    const interval = setInterval(fetchPending, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <SidebarHeader className="px-4 pt-6 pb-4">
        <Link
          href="/patients"
          onClick={() => setOpenMobile(false)}
          className="flex items-center justify-center"
        >
          <span className="text-center font-display text-2xl font-semibold tracking-[-0.03em] text-sidebar-foreground">
            Cymple
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="mx-4" />

      <SidebarContent className="px-3 py-4">
        <SidebarGroup className="h-full py-1">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40">
            Menú
          </SidebarGroupLabel>
          <SidebarGroupContent className="h-full">
            <SidebarMenu className="flex h-full flex-col justify-center gap-3">
              {baseNavItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                const showBadge = item.badgeKey === "appointments" && pendingCount > 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      size="lg"
                      render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-[15px] font-medium transition-all",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className="size-5" />
                        {showBadge && (
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                            {pendingCount > 9 ? "9+" : pendingCount}
                          </span>
                        )}
                      </span>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-5">
        <SidebarSeparator className="mb-3" />
        <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground/80">
              {professionalName}
            </p>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
