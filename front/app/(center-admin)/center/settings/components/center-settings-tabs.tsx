"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageTemplate } from "@/lib/types";
import { MessageTemplatesTab } from "@/app/(dashboard)/settings/components/message-templates-tab";
import { WhatsappConnectionCard } from "@/app/(dashboard)/settings/components/whatsapp-connection-card";
import { BookingSettingsTab } from "./booking-settings-tab";

export function CenterSettingsTabs({ templates }: { templates: MessageTemplate[] }) {
  return (
    <Tabs defaultValue="whatsapp" className="space-y-6">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="whatsapp" className="flex-1 sm:flex-none">WhatsApp</TabsTrigger>
        <TabsTrigger value="templates" className="flex-1 sm:flex-none">Plantillas</TabsTrigger>
        <TabsTrigger value="reservas-online" className="flex-1 sm:flex-none">Reservas Online</TabsTrigger>
      </TabsList>

      <TabsContent value="whatsapp" className="mt-0 space-y-6">
        <WhatsappConnectionCard />
      </TabsContent>

      <TabsContent value="templates" className="mt-0 space-y-6">
        <MessageTemplatesTab initialTemplates={templates} />
      </TabsContent>

      <TabsContent value="reservas-online" className="mt-0 space-y-6">
        <BookingSettingsTab />
      </TabsContent>
    </Tabs>
  );
}