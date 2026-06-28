"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { NotificationDetailSheet, getTypeConfig } from "./notification-detail-sheet";
import type { AppNotification } from "./notification-detail-sheet";

type NotificationsResponse = {
  items: AppNotification[];
  unreadCount: number;
};

let notificationAudio: HTMLAudioElement | null = null;

function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio("/notificacion.mp3");
    }
    void notificationAudio.play();
  } catch {
    // Browser may block autoplay
  }
}

function groupByDay(items: AppNotification[]) {
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const earlier: AppNotification[] = [];

  const now = new Date();
  const twoDaysAgo = subDays(now, 2);

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (isToday(date)) {
      today.push(item);
    } else if (isYesterday(date)) {
      yesterday.push(item);
    } else if (isAfter(date, twoDaysAgo)) {
      earlier.push(item);
    } else {
      earlier.push(item);
    }
  }

  const groups: { label: string; items: AppNotification[] }[] = [];
  if (today.length > 0) groups.push({ label: "Hoy", items: today });
  if (yesterday.length > 0) groups.push({ label: "Ayer", items: yesterday });
  if (earlier.length > 0) groups.push({ label: "Anteriores", items: earlier });
  return groups;
}

export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsResponse>({
    items: [],
    unreadCount: 0,
  });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && data.unreadCount > 0) {
      setData((prev) => ({ ...prev, unreadCount: 0 }));
      try {
        await fetch("/api/backend/notifications/mark-read", {
          method: "PATCH",
        });
      } catch {
        // silently ignore
      }
    }
  }

  function handleNotificationClick(notif: AppNotification) {
    setSelected(notif);
    setSheetOpen(true);
  }

  function handleNavigate(link: string) {
    setOpen(false);
    setSheetOpen(false);
    router.push(link);
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initial fetch for immediate state (items + unreadCount)
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/backend/notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        setData(await res.json());
      } catch {
        // ignore
      }
    }
    load();
    return () => controller.abort();
  }, []);

  // SSE connection for real-time push notifications
  useEffect(() => {
    const eventSource = new EventSource("/api/backend/notifications/stream");

    eventSource.addEventListener("notification", (event: MessageEvent) => {
      try {
        const notification: AppNotification = JSON.parse(event.data);
        setData((prev) => {
          // Evitar duplicados (SSE + fetch inicial pueden solaparse)
          if (prev.items.some((n) => n.id === notification.id)) return prev;
          const items = [notification, ...prev.items].slice(0, 50);
          const unreadCount = notification.readAt
            ? prev.unreadCount
            : prev.unreadCount + 1;
          return { items, unreadCount };
        });

        // Sonido solo si no está leída
        if (!notification.readAt) {
          playNotificationSound();
        }
      } catch {
        // ignore malformed SSE data
      }
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects — no action needed
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const DISPLAY_LIMIT = 3;
  const capped = data.items.slice(0, DISPLAY_LIMIT);
  const groups = groupByDay(capped);

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={handleOpen}
          className={cn(
            "relative flex size-8 items-center justify-center rounded-xl transition-all duration-200",
            open
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
          )}
          aria-label="Notificaciones"
        >
          <Bell className={cn("size-4 transition-transform", open && "scale-95")} />
          {data.unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-in zoom-in duration-200">
              {data.unreadCount > 9 ? "9+" : data.unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-50 w-[360px] animate-in slide-in-from-top-2 fade-in duration-200 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-sm font-semibold tracking-tight">Notificaciones</p>
              {data.unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {data.unreadCount} sin leer
                </span>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {data.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50">
                    <Bell className="size-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sin notificaciones
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 px-5 py-2 bg-card/95 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        {group.label}
                      </p>
                    </div>
                    <div className="px-2 pb-1">
                      {group.items.map((notif) => {
                        const config = getTypeConfig(notif.type);
                        const Icon = config.icon;
                        return (
                          <button
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                              "hover:bg-muted/60 active:scale-[0.99]",
                              !notif.readAt && "bg-primary/4",
                            )}
                          >
                            <div className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                              config.bg,
                            )}>
                              <Icon className={cn("size-4", config.color)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5">
                                <p className={cn(
                                  "truncate text-sm leading-snug",
                                  !notif.readAt ? "font-semibold" : "font-medium text-foreground/80",
                                )}>
                                  {notif.title}
                                </p>
                              </div>
                              {notif.body && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground leading-relaxed">
                                  {notif.body}
                                </p>
                              )}
                              <p className="mt-1 text-[10px] text-muted-foreground/50 tabular-nums">
                                {formatDistanceToNow(new Date(notif.createdAt), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </p>
                            </div>
                            {!notif.readAt && (
                              <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              {data.items.length > DISPLAY_LIMIT && (
                <button
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-1 py-2.5 text-xs font-medium text-primary hover:bg-muted/40 transition-colors border-t border-border"
                >
                  Ver todas ({data.items.length})
                  <ChevronRight className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <NotificationDetailSheet
        notification={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onNavigate={handleNavigate}
      />
    </>
  );
}