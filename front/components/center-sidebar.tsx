"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  MessageSquareText,
  Calendar,
  DollarSign,
  Settings,
  Stethoscope,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoutButton } from "@/components/logout-button";

const centerNavItems = [
  { href: "/center/home", label: "Inicio", icon: Home },
  { href: "/center/professionals", label: "Profesionales", icon: Stethoscope },
  { href: "/center/patients", label: "Pacientes", icon: Users },
  { href: "/center/appointments", label: "Agenda", icon: Calendar },
  { href: "/center/finance", label: "Finanzas", icon: DollarSign },
  { href: "/center/messages", label: "Mensajes", icon: MessageSquareText },
  { href: "/center/settings", label: "Configuración", icon: Settings },
];

type CenterSidebarProps = {
  centerName: string;
};

export function CenterSidebar({ centerName }: CenterSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const initials = useMemo(() => {
    return centerName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [centerName]);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes sidebar-slide-in {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .sidebar-nav-item { animation: sidebar-slide-in 0.35s cubic-bezier(0.25, 0.1, 0.25, 1) both; }
        .sidebar-btn { transition: background-color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1), color 0.2s, transform 0.15s; }
        .sidebar-btn:hover { transform: translateX(1px); }
        .sidebar-btn:active { transform: scale(0.985); }
        .sidebar-footer-row { transition: background-color 0.2s; }
        .sidebar-footer-row:hover { background-color: rgba(0,0,0,0.04); }
      `
      }} />

      <Sidebar
        collapsible="offcanvas"
        className="border-r border-[var(--border-light)] bg-[var(--col-bg13)]"
      >
        <SidebarHeader className="px-5 pt-7 pb-5">
          <Link
            href="/center/home"
            onClick={() => setOpenMobile(false)}
            className="group flex items-center gap-2.5 outline-none"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0071e3] shadow-[var(--shadow-subtle)] transition-transform duration-200 group-hover:scale-105">
              <Stethoscope className="size-4 text-white" strokeWidth={2} />
            </div>
            <span className="font-display text-[19px] font-semibold tracking-tight text-[#0a0a0a] dark:text-foreground">
              Cymple
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-3 pb-2 pt-1">
          <SidebarGroup className="py-0">
            <SidebarGroupLabel className="px-3 pb-2 pt-0 font-mid text-[11px] font-medium uppercase tracking-[0.1em] text-[#1d1d1f]">
              Centro Médico
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {centerNavItems.map((item, index) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        size="lg"
                        render={
                          <Link
                            href={item.href}
                            onClick={() => setOpenMobile(false)}
                          />
                        }
                        className={cn(
                          "sidebar-btn sidebar-nav-item group relative rounded-full px-3 py-2.5",
                          active
                            ? "bg-black/[0.05] text-[#0a0a0a] data-active:!bg-black/[0.05] data-active:!text-[#0a0a0a]"
                            : "text-[#0a0a0a] hover:!bg-black/[0.04]"
                        )}
                        style={{
                          animationDelay: mounted ? `${index * 35}ms` : "0ms",
                        }}
                      >
                        <Icon
                          className={cn(
                            "size-[18px]",
                            active ? "text-[#0071e3]" : "text-[#0a0a0a] opacity-90"
                          )}
                          strokeWidth={active ? 2.2 : 1.8}
                        />
                        <span
                          className={cn(
                            "text-[14px] leading-normal",
                            active ? "font-semibold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"
                          )}
                        >
                          {item.label}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-3 pb-5 pt-1">
          <div className="mx-2 mb-2 h-px bg-[var(--border-light)]" />
          <div className="sidebar-footer-row flex items-center gap-3 rounded-full px-2.5 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0fb] ring-1 ring-[#0071e3]/20">
              <span className="text-[11px] font-semibold text-[#0071e3]">
                {initials}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium leading-tight text-[#0a0a0a]">
                {centerName}
              </p>
              <p className="text-[12px] leading-tight text-[#1d1d1f]">
                Administrador
              </p>
            </div>
            <LogoutButton />
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
