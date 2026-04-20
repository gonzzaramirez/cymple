"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import {
  messageTypeLabel,
  MESSAGE_DIRECTION_LABELS,
} from "@/lib/message-log-labels";
import type { MessageLogWithPatient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function badgeVariantForType(
  messageType: string,
): "default" | "secondary" | "success" | "warning" | "info" | "destructive" {
  switch (messageType) {
    case "APPOINTMENT_CREATED":
      return "info";
    case "APPOINTMENT_REMINDER":
      return "warning";
    case "PATIENT_REPLY":
      return "secondary";
    case "SYSTEM":
      return "success";
    case "APPOINTMENT_CANCELLED":
      return "destructive";
    case "APPOINTMENT_RESCHEDULED":
      return "default";
    default:
      return "secondary";
  }
}

export function PatientMessages({
  type,
  messages,
}: {
  type: string;
  messages: MessageLogWithPatient[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card className="shadow-card">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariantForType(type)}>
              {messageTypeLabel(type)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {messages.length} mensaje{messages.length === 1 ? "" : "s"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {messages.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-border/60 bg-card/50 p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Badge variant="outline">
                  {MESSAGE_DIRECTION_LABELS[row.direction] ?? row.direction}
                </Badge>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={row.createdAt}
                >
                  {format(new Date(row.createdAt), "dd/MM/yyyy HH:mm", {
                    locale: es,
                  })}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {row.content}
              </p>
              {row.toPhone || row.fromPhone ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {row.direction === "OUTBOUND"
                    ? `→ ${row.toPhone ?? ""}`
                    : `← ${row.fromPhone ?? ""}`}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
