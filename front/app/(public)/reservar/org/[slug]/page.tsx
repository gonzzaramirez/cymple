import type { Metadata } from "next";
import { CenterBookingClient } from "./center-booking-client";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cymple.online";
  const pageUrl = `${baseUrl}/reservar/org/${slug}`;

  let orgName: string | null = null;
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:3080/v1";
    const res = await fetch(`${apiBase}/public/organizations/${slug}/professionals`, {
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
