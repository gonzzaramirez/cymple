import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/server-api";
import { MessageTemplate } from "@/lib/types";
import { CenterSettingsTabs } from "./components/center-settings-tabs";

export const metadata: Metadata = {
  title: "Configuración | Centro Médico | Cymple",
};

export default async function CenterSettingsPage() {
  const templates = await serverApiFetch<MessageTemplate[]>("message-templates").catch(() => []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Configuración
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Configuración del centro y WhatsApp compartido.
        </p>
      </div>
      <CenterSettingsTabs templates={templates} />
    </section>
  );
}