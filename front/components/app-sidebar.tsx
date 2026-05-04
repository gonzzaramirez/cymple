"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoutButton } from "@/components/logout-button";

const baseNavItems = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/messages", label: "Mensajes", icon: MessageSquareText },
  {
    href: "/appointments",
    label: "Agenda",
    icon: Calendar,
    badgeKey: "appointments" as const,
  },
  { href: "/finance", label: "Finanzas", icon: DollarSign },
  { href: "/availability", label: "Disponibilidad", icon: Clock },
  { href: "/settings", label: "Configuración", icon: Settings },
];

type AppSidebarProps = {
  professionalName: string;
  pendingNext24h?: number;
  centerName?: string;
};

export function AppSidebar({
  professionalName,
  pendingNext24h: initialPending = 0,
  centerName,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [pendingCount, setPendingCount] = useState(initialPending);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    async function fetchPending() {
      try {
        const res = await fetch("/api/backend/dashboard/stats", {
          cache: "no-store",
        });
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

  const initials = useMemo(() => {
    return professionalName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [professionalName]);

  const firstName = useMemo(() => {
    return professionalName.split(" ")[0] || "";
  }, [professionalName]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sidebar-slide-in {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes sidebar-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.45); }
          50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
        }
        @keyframes sidebar-indicator-in {
          from { opacity: 0; transform: scaleY(0); }
          to { opacity: 1; transform: scaleY(1); }
        }
        .sidebar-nav-item {
          animation: sidebar-slide-in 0.35s cubic-bezier(0.25, 0.1, 0.25, 1) both;
        }
        .sidebar-badge-pulse {
          animation: sidebar-badge-pulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .sidebar-indicator {
          animation: sidebar-indicator-in 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) both;
          transform-origin: center;
        }
        .sidebar-btn {
          transition: background-color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
                      color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
                      transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .sidebar-btn:hover {
          transform: translateX(1px);
        }
        .sidebar-btn:active {
          transform: scale(0.985);
        }
        .sidebar-btn-icon {
          transition: color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .sidebar-btn-label {
          transition: color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
                      font-weight 0.15s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .sidebar-footer-row {
          transition: background-color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .sidebar-footer-row:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }
      `}} />

      <Sidebar
        collapsible="offcanvas"
        className="border-r border-[var(--border-light)] bg-[var(--col-bg13)]"
      >
        {/* ── Logo ── */}
        <SidebarHeader className="px-5 pt-7 pb-5">
          <div className="relative flex items-center justify-center">
            <Link
              href="/home"
              onClick={() => setOpenMobile(false)}
              className="absolute left-0 flex size-8 items-center justify-center rounded-lg bg-[#181e25] shadow-[var(--shadow-subtle)] transition-transform duration-200 hover:scale-105"
            >
              <Image
                src="/favicon-96x96.png"
                alt="Cymple"
                width={20}
                height={20}
                className="size-5"
              />
            </Link>
            <Link
              href="/home"
              onClick={() => setOpenMobile(false)}
              className="outline-none"
            >
              <span className="font-display text-[19px] font-semibold tracking-tight text-[#0a0a0a] dark:text-foreground">
                Cymple
              </span>
            </Link>
          </div>
        </SidebarHeader>

        {/* ── Navigation ── */}
        <SidebarContent className="px-3 pb-2 pt-1">
          <SidebarGroup className="py-0">
            <SidebarGroupLabel className="px-3 pb-2 pt-0 font-mid text-[11px] font-medium uppercase tracking-[0.1em] text-[#1d1d1f]">
              Menú
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {baseNavItems.map((item, index) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  const showBadge =
                    item.badgeKey === "appointments" && pendingCount > 0;

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
                            ? "bg-black/[0.05] text-[#0a0a0a] data-active:!bg-black/[0.05] data-active:!text-[#0a0a0a] dark:bg-white/[0.08] dark:text-foreground dark:data-active:!bg-white/[0.08] dark:data-active:!text-foreground"
                            : "text-[#0a0a0a] hover:!bg-black/[0.04] dark:text-foreground/95 dark:hover:!bg-white/[0.05]"
                        )}
                        style={{
                          animationDelay: mounted
                            ? `${index * 35}ms`
                            : "0ms",
                        }}
                      >
                        <span className="relative shrink-0">
                          <Icon
                            className={cn(
                              "sidebar-btn-icon size-[18px]",
                              active
                                ? "text-[#0a0a0a] dark:text-foreground"
                                : "text-[#0a0a0a] opacity-90 group-hover:opacity-100 dark:text-foreground/90 dark:group-hover:text-foreground"
                            )}
                            strokeWidth={active ? 2.2 : 1.8}
                          />
                          {showBadge && (
                            <span className="sidebar-badge-pulse absolute -right-1.5 -top-1.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-semibold text-primary-foreground">
                              {pendingCount > 9 ? "9+" : pendingCount}
                            </span>
                          )}
                        </span>

                        <span
                          className={cn(
                            "sidebar-btn-label text-[14px] font-medium leading-normal",
                            active
                              ? "font-semibold text-[#0a0a0a] dark:text-foreground"
                              : "font-medium text-[#0a0a0a] dark:text-foreground/95"
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

        {/* ── Footer / User ── */}
        <SidebarFooter className="px-3 pb-5 pt-1">
          <div className="mx-2 mb-2 h-px bg-[var(--border-light)]" />

          <div className="sidebar-footer-row flex items-center gap-3 rounded-full px-2.5 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] ring-1 ring-border dark:bg-muted dark:ring-border">
              <span className="text-[11px] font-semibold text-[#0a0a0a] dark:text-foreground">
                {initials}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium leading-tight text-[#0a0a0a] dark:text-foreground">
                {firstName}
              </p>
              <p className="truncate text-[12px] leading-tight text-[#1d1d1f] dark:text-muted-foreground">
                {centerName ? centerName : "Profesional"}
              </p>
            </div>

            <LogoutButton />
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}