"use client";

import { useEffect, useState, useCallback } from "react";
import { sileo } from "sileo";
import { Loader2 } from "lucide-react";
import {
  listBookings,
  getBookingDetail,
  BookingSummary,
  BookingDetail,
  BookingStatus,
} from "@/lib/api/bookings";
import { BookingsFilters, BookingsList, BookingDetailDialog } from "@/components/bookings";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<BookingStatus | "ALL">("ALL");
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<BookingSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const data = await listBookings({ status, month, year, page, limit: 10 });
      setBookings(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Error al cargar las reservas. Verificá que el backend esté corriendo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, [status, month, year, page]);

  useEffect(() => {
    setPage(1);
  }, [status, month, year]);

  const handleSelect = useCallback(async (booking: BookingSummary) => {
    setSelectedBooking(booking);
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const detail = await getBookingDetail(booking.id);
      setDetailData(detail);
    } catch {
      setDetailData(null);
      sileo.error({ title: "No se pudo cargar el detalle de la reserva" });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshWithPage = useCallback(
    (currentPage: number) => {
      void listBookings({ status, month, year, page: currentPage, limit: 10 }).then(
        (data) => setBookings(data.items),
      );
    },
    [status, month, year],
  );

  const handleDepositPaid = useCallback(() => {
    // Refresh detail and list
    if (selectedBooking) {
      getBookingDetail(selectedBooking.id).then(setDetailData).catch(() => {});
    }
    refreshWithPage(page);
  }, [selectedBooking, page, refreshWithPage]);

  const handleCancel = useCallback(() => {
    if (selectedBooking) {
      getBookingDetail(selectedBooking.id).then(setDetailData).catch(() => {});
    }
    refreshWithPage(page);
  }, [selectedBooking, page, refreshWithPage]);

  const handleNotesChange = useCallback(() => {
    if (selectedBooking) {
      getBookingDetail(selectedBooking.id).then(setDetailData).catch(() => {});
    }
  }, [selectedBooking]);

  const handleManualConfirm = useCallback(() => {
    if (selectedBooking) {
      getBookingDetail(selectedBooking.id).then(setDetailData).catch(() => {});
    }
    refreshWithPage(page);
  }, [selectedBooking, page, refreshWithPage]);

  const handleStatusChange = useCallback((newStatus: BookingStatus | "ALL") => {
    setStatus(newStatus);
  }, []);

  const handleMonthChange = useCallback((newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Reservas
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gestioná las reservas entrantes desde el sistema público de turnos.
          Marcá depósitos como pagados y cancelá reservas cuando sea necesario.
        </p>
      </div>

      <BookingsFilters
        status={status}
        month={month}
        year={year}
        onStatusChange={handleStatusChange}
        onMonthChange={handleMonthChange}
      />

      {error && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <BookingsList
        bookings={bookings}
        onSelect={handleSelect}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={handlePageChange}
      />

      {detailData && (
        <BookingDetailDialog
          booking={detailData}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onDepositPaid={handleDepositPaid}
          onCancel={handleCancel}
          onNotesChange={handleNotesChange}
          onManualConfirm={handleManualConfirm}
        />
      )}

      {/* Show skeleton detail if loading */}
      {detailLoading && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-card p-6 shadow-elevated">
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Cargando detalle...
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
