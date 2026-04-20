import { SettingsForm } from "./components/settings-form";
import { WhatsappConnectionCard } from "./components/whatsapp-connection-card";
import { serverApiFetch } from "@/lib/server-api";
import { ProfessionalSettings } from "@/lib/types";

export default async function SettingsPage() {
  const settings =
    await serverApiFetch<ProfessionalSettings>("professional/settings");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parámetros base de agenda y recordatorios
        </p>
      </div>
      <WhatsappConnectionCard />
      <SettingsForm settings={settings} />
    </section>
  );
}
