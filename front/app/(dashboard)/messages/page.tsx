import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  Search,
} from "lucide-react";
import { serverApiFetch } from "@/lib/server-api";
import { messageTypeLabel } from "@/lib/message-log-labels";
import type { ApiList, MessageGroupedByPatient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function buildQuery(base: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  if (base.page) qs.set("page", base.page);
  qs.set("limit", "20");
  if (base.search) qs.set("search", base.search);
  if (base.dateFrom) qs.set("dateFrom", base.dateFrom);
  if (base.dateTo) qs.set("dateTo", base.dateTo);
  return qs.toString();
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.search;
  const dateFrom = sp.dateFrom;
  const dateTo = sp.dateTo;

  const query = buildQuery({
    page: String(page),
    search,
    dateFrom,
    dateTo,
  });

  const data = await serverApiFetch<ApiList<MessageGroupedByPatient>>(
    `messages/grouped?${query}`,
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          Mensajes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial de WhatsApp agrupado por paciente.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="msg-search"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Buscar paciente
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="msg-search"
                  name="search"
                  type="text"
                  defaultValue={search ?? ""}
                  placeholder="Nombre del paciente..."
                  className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm ring-ring transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2"
                />
              </div>
            </div>
            <div className="min-w-[140px]">
              <label
                htmlFor="msg-date-from"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Desde
              </label>
              <input
                id="msg-date-from"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom ?? ""}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm ring-ring transition-colors focus:outline-none focus:ring-2"
              />
            </div>
            <div className="min-w-[140px]">
              <label
                htmlFor="msg-date-to"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Hasta
              </label>
              <input
                id="msg-date-to"
                name="dateTo"
                type="date"
                defaultValue={dateTo ?? ""}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm ring-ring transition-colors focus:outline-none focus:ring-2"
              />
            </div>
            <button
              type="submit"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Filtrar
            </button>
            {search || dateFrom || dateTo ? (
              <Link
                href="/messages"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Limpiar
              </Link>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <MessageSquareText className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No hay mensajes con estos filtros.
            </p>
          </div>
        ) : (
          data.items.map((item) => (
            <Link key={item.patientId} href={`/messages/${item.patientId}`}>
              <Card className="shadow-card transition-all hover:shadow-card-hover hover:border-primary/20 cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    {item.lastName}, {item.firstName}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {item.phone}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(item.typeCounts).map(([type, count]) => (
                      <Badge
                        key={type}
                        variant={badgeVariantForType(type)}
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {messageTypeLabel(type)} {count}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {item.totalMessages} mensaje
                      {item.totalMessages === 1 ? "" : "s"}
                    </span>
                    {item.lastMessageAt ? (
                      <time dateTime={item.lastMessageAt}>
                        {format(new Date(item.lastMessageAt), "dd/MM/yy HH:mm", {
                          locale: es,
                        })}
                      </time>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={`/messages?${buildQuery({ page: String(page - 1), search, dateFrom, dateTo })}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
              )}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Link>
          ) : (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-40",
              )}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </span>
          )}
          {page < data.totalPages ? (
            <Link
              href={`/messages?${buildQuery({ page: String(page + 1), search, dateFrom, dateTo })}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
              )}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-40",
              )}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}
