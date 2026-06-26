// Server component: metadata for the intake form page.
import type { Metadata } from "next";
import FichaClient from "./ficha-client";

export const metadata: Metadata = {
  title: "Ficha de ingreso — Cymple",
  description:
    "Completá tu ficha clínica de ingreso. Datos de salud, hábitos y cuidados de la piel.",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ intakeToken: string }>;
};

export default async function Page({ params }: Props) {
  const { intakeToken } = await params;
  return <FichaClient intakeToken={intakeToken} />;
}
