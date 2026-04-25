import { serverApiFetch } from "@/lib/server-api";
import { MessageTemplate, ProfessionalSettings } from "@/lib/types";
import { SettingsTabs } from "./components/settings-tabs";

export default async function SettingsPage() {
  const [settings, templates] = await Promise.all([
    serverApiFetch<ProfessionalSettings>("professional/settings"),
    serverApiFetch<MessageTemplate[]>("message-templates"),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parámetros de agenda, WhatsApp y plantillas de mensajes
        </p>
      </div>
      <SettingsTabs settings={settings} templates={templates} />
    </section>
  );
}
