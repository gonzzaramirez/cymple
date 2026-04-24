"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  items: AppNotification[];
  unreadCount: number;
};

const TYPE_ICONS: Record<string, string> = {
  PATIENT_CONFIRMED: "✅",
  PATIENT_CANCELLED: "❌",
  APPOINTMENT_RESCHEDULED: "🔄",
  APPOINTMENT_CANCELLED_SENT: "🚫",
};

export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsResponse>({
    items: [],
    unreadCount: 0,
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/backend/notifications", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json: NotificationsResponse = await res.json();
      setData(json);
    } catch {
      // silently ignore
    }
  }

  async function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && data.unreadCount > 0) {
      // Mark all as read optimistically
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

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, []);

  function handleNotificationClick(notif: AppNotification) {
    setOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-xl transition-colors",
          open
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
        aria-label="Notificaciones"
      >
        <Bell className="size-4" />
        {data.unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {data.unreadCount > 9 ? "9+" : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-border bg-card shadow-elevated">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {data.items.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {data.items.length} recientes
              </span>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {data.items.length === 0 ? (
              <li className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="size-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Sin notificaciones
                </p>
              </li>
            ) : (
              data.items.map((notif) => (
                <li key={notif.id}>
                  <button
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !notif.readAt && "bg-blue-50/60 dark:bg-blue-950/20",
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-base leading-none">
                      {TYPE_ICONS[notif.type] ?? "🔔"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="truncate text-xs text-muted-foreground">
                          {notif.body}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(notif.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    {!notif.readAt && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#0071e3]" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
