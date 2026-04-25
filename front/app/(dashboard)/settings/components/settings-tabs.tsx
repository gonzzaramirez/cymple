"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageTemplate, ProfessionalSettings } from "@/lib/types";
import { SettingsForm } from "./settings-form";
import { WhatsappConnectionCard } from "./whatsapp-connection-card";
import { MessageTemplatesTab } from "./message-templates-tab";

interface SettingsTabsProps {
  settings: ProfessionalSettings;
  templates: MessageTemplate[];
}

export function SettingsTabs({ settings, templates }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="general" className="flex-1 sm:flex-none">
          General
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="flex-1 sm:flex-none">
          WhatsApp
        </TabsTrigger>
        <TabsTrigger value="templates" className="flex-1 sm:flex-none">
          Plantillas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-0 space-y-6">
        <SettingsForm settings={settings} />
      </TabsContent>

      <TabsContent value="whatsapp" className="mt-0 space-y-6">
        <WhatsappConnectionCard />
      </TabsContent>

      <TabsContent value="templates" className="mt-0 space-y-6">
        <MessageTemplatesTab initialTemplates={templates} />
      </TabsContent>
    </Tabs>
  );
}
