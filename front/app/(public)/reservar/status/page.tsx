// Server component: metadata for the status page.
import type { Metadata } from "next";
import BookingStatusPage from "./status-client";

export const metadata: Metadata = {
  title: "Estado de tu reserva — Cymple",
  description:
    "Consultá el estado de tu reserva con tu código. Confirmación, seña y próximos pasos.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BookingStatusPage />;
}
