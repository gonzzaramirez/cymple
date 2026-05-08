"use client";

import { XIcon, CheckCircle2Icon, XCircleIcon, ClockIcon, UserPlusIcon, BotIcon, MessageCircleQuestionIcon, BanIcon, ExternalLinkIcon } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose,
} from "@/components/ui/sheet";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
  appointmentId?: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type NotificationTypeConfig = {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
};

const TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  PATIENT_CONFIRMED: {
    icon: CheckCircle2Icon,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    label: "Turno confirmado",
  },
  PATIENT_CANCELLED: {
    icon: XCircleIcon,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    label: "Turno cancelado",
  },
  APPOINTMENT_RESCHEDULED: {
    icon: ClockIcon,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    label: "Turno reprogramado",
  },
  APPOINTMENT_CANCELLED_SENT: {
    icon: BanIcon,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    label: "Turno cancelado",
  },
  APPOINTMENT_CANCELLED: {
    icon: BanIcon,
    color: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-900/40",
    label: "Turno cancelado",
  },
  APPOINTMENT_AUTO_CONFIRMED: {
    icon: BotIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    label: "Auto-confirmado",
  },
  WA_UNKNOWN_REPLY: {
    icon: MessageCircleQuestionIcon,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    label: "WhatsApp",
  },
  NEW_INBOUND_MESSAGE: {
    icon: MessageCircleQuestionIcon,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    label: "Mensaje entrante",
  },
  NEW_PATIENT: {
    icon: UserPlusIcon,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    label: "Nuevo paciente",
  },
};

const DEFAULT_CONFIG: NotificationTypeConfig = {
  icon: CheckCircle2Icon,
  color: "text-zinc-600 dark:text-zinc-400",
  bg: "bg-zinc-50 dark:bg-zinc-900/40",
  label: "Notificación",
};

export function getTypeConfig(type: string): NotificationTypeConfig {
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
}

type NotificationDetailSheetProps = {
  notification: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (link: string) => void;
};

export function NotificationDetailSheet({
  notification,
  open,
  onOpenChange,
  onNavigate,
}: NotificationDetailSheetProps) {
  if (!notification) return null;

  const config = getTypeConfig(notification.type);
  const Icon = config.icon;
  const hasLink = !!notification.link;
  const createdAt = new Date(notification.createdAt);

  const formattedDate = isToday(createdAt)
    ? `Hoy, ${format(createdAt, "HH:mm", { locale: es })}`
    : isYesterday(createdAt)
      ? `Ayer, ${format(createdAt, "HH:mm", { locale: es })}`
      : format(createdAt, "d 'de' MMMM, HH:mm", { locale: es });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("flex size-10 items-center justify-center rounded-xl", config.bg)}>
                <Icon className={cn("size-5", config.color)} />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold leading-tight">
                  {notification.title}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  {config.label} &middot; {formattedDate}
                </SheetDescription>
              </div>
            </div>
            <SheetClose className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <XIcon className="size-4" />
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-4">
          {notification.body && (
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-sm leading-relaxed text-foreground">
                {notification.body}
              </p>
            </div>
          )}

          {notification.appointmentId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClockIcon className="size-3.5" />
              <span>Turno vinculado</span>
            </div>
          )}

          {hasLink && (
            <button
              onClick={() => {
                onOpenChange(false);
                onNavigate(notification.link!);
              }}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                "bg-foreground text-background hover:bg-foreground/90",
                "active:scale-[0.98]",
              )}
            >
              {notification.link?.includes("/messages/") ? "Ver conversación" : notification.appointmentId ? "Ver turno" : "Ir"}
              <ExternalLinkIcon className="size-3.5" />
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}