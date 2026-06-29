"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookingSummary, STATUS_BADGE_MAP } from "@/lib/api/bookings";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type BookingsListProps = {
  bookings: BookingSummary[];
  onSelect: (booking: BookingSummary) => void;
  loading?: boolean;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  showProfessional?: boolean;
};

function formatSlotDate(booking: BookingSummary): string {
  const datePart = booking.slotDate.slice(0, 10);
  const d = new Date(`${datePart}T${booking.slotStart}:00`);
  return format(d, "EEE dd/MM", { locale: es });
}

function formatSlotTime(booking: BookingSummary): string {
  const start = booking.slotStart.slice(0, 5);
  const end = booking.slotEnd.slice(0, 5);
  return `${start} - ${end}`;
}

function BookingCard({
  booking,
  onSelect,
  showProfessional,
}: {
  booking: BookingSummary;
  onSelect: () => void;
  showProfessional?: boolean;
}) {
  const statusCfg = booking.status === "BOOKED" && booking.depositPaidAt
    ? { label: "Pagado", variant: "success" as const }
    : STATUS_BADGE_MAP[booking.status] ?? { label: booking.status, variant: "secondary" as const };
  const depositPaid = booking.depositPaidAt !== null && booking.depositPaidAt !== undefined;

  return (
    <Card
      size="sm"
      className="cursor-pointer transition-shadow hover:shadow-card-hover"
      onClick={onSelect}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              {booking.patientName}
            </CardTitle>
            {showProfessional && booking.professionalName && (
              <p className="text-xs text-muted-foreground">
                {booking.professionalName}
              </p>
            )}
            <CardDescription className="mt-0.5">
              {booking.patientPhone}
            </CardDescription>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
              {booking.token}
            </p>
          </div>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatSlotDate(booking)} · {formatSlotTime(booking)}
          </span>
          {depositPaid && (
            <Badge variant="success">Depósito pagado</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BookingsList({
  bookings,
  onSelect,
  loading,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
  showProfessional,
}: BookingsListProps) {
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className={cn("space-y-3", !isMobile && "space-y-0")}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            {isMobile ? (
              <div className="space-y-2 rounded-2xl border border-border/50 p-4">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-3 w-28 rounded-full" />
              </div>
            ) : (
              <Skeleton className="h-12 w-full rounded-lg" />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center">
        <p className="text-lg text-muted-foreground">
          No hay reservas para este período
        </p>
        <p className="text-sm text-muted-foreground">
          Cambiá el filtro de estado o mes para ver más resultados
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            onSelect={() => onSelect(booking)}
            showProfessional={showProfessional}
          />
        ))}

        <PaginationControls
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={onPageChange}
        />
      </div>
    );
  }

  // Desktop table
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            {showProfessional && <TableHead>Profesional</TableHead>}
            <TableHead>Teléfono</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Depósito</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
        {bookings.map((booking) => {
          const statusCfg = booking.status === "BOOKED" && booking.depositPaidAt
            ? { label: "Pagado", variant: "success" as const }
            : STATUS_BADGE_MAP[booking.status] ?? { label: booking.status, variant: "secondary" as const };

          return (
            <TableRow
                key={booking.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => onSelect(booking)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{booking.patientName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground/70">
                      {booking.token}
                    </span>
                  </div>
                </TableCell>
                {showProfessional && (
                  <TableCell className="text-muted-foreground">
                    {booking.professionalName ?? '—'}
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {booking.patientPhone}
                </TableCell>
                <TableCell>{formatSlotDate(booking)}</TableCell>
                <TableCell>{formatSlotTime(booking)}</TableCell>
                <TableCell>
                  <Badge variant={statusCfg.variant}>
                    {statusCfg.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {booking.depositPaidAt ? (
                    <Badge variant="success">Pagado</Badge>
                  ) : booking.depositAmount ? (
                    <Badge variant="warning">Pendiente</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">Ver</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange?: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {total != null && `${total} reservas · `}Página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[2rem] text-center text-sm tabular-nums text-muted-foreground">
          {page}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
