import type { Metadata } from "next";
import { CenterBookingClient } from "./center-booking-client";
import { APP_URL, API_BASE_URL } from "@/lib/env";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pageUrl = `${APP_URL}/reservar/org/${slug}`;

  let orgName: string | null = null;
  try {
    const res = await fetch(`${API_BASE_URL}/public/organizations/${slug}/professionals`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ fullName: string }>;
      if (data.length > 0) {
        orgName = `Centro Médico ${slug}`;
      }
    }
  } catch {
    // fallback
  }

  const title = orgName
    ? `Reservá tu turno - ${orgName}`
    : "Reservá tu turno en el centro médico";
  const description = "Seleccioná tu profesional y reservá tu turno online. Confirmación instantánea por WhatsApp.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Cymple",
      type: "website",
      locale: "es_AR",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <CenterBookingClient orgSlug={slug} />;
}
