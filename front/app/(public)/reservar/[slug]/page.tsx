// Server component: handles metadata (Next.js 16 — params is a Promise).
// Heavy lifting lives in the client component.
import type { Metadata } from "next";
import PublicBookingPage from "./booking-client";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cymple.online";
  const pageUrl = `${baseUrl}/reservar/${slug}`;

  // Best-effort: try to enrich metadata with the professional name.
  // We don't fail the metadata call on network errors — the page can still render.
  let professionalName: string | null = null;
  let specialty: string | null = null;
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:3080/v1";
    const res = await fetch(`${apiBase}/public/professionals/${slug}`, {
      next: { revalidate: 300 }, // 5 min cache
    });
    if (res.ok) {
      const data = (await res.json()) as {
        fullName?: string;
        specialty?: string | null;
      };
      professionalName = data.fullName ?? null;
      specialty = data.specialty ?? null;
    }
  } catch {
    // ignore — fallback metadata below
  }

  const title = professionalName
    ? `Reservá tu turno con ${professionalName}`
    : "Reservá tu turno";
  const description = professionalName
    ? `Reservá online con ${professionalName}${specialty ? `, ${specialty}` : ""}. Confirmación instantánea por WhatsApp.`
    : "Reservá online tu turno. Confirmación instantánea por WhatsApp.";

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
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: pageUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <PublicBookingPage slug={slug} />;
}
