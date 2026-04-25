"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageTemplate, MessageTemplateType } from "@/lib/types";
import {
  DEFAULT_TEMPLATE_BODIES,
  getTemplateMeta,
  TEMPLATE_META,
} from "@/lib/message-templates";
import { TemplateEditor } from "./template-editor";

interface MessageTemplatesTabProps {
  initialTemplates: MessageTemplate[];
}

async function apiUpsert(
  type: MessageTemplateType,
  body: string,
  isEnabled: boolean,
): Promise<MessageTemplate> {
  const res = await fetch(`/api/backend/message-templates/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, isEnabled }),
  });
  if (!res.ok) throw new Error("Error al guardar plantilla");
  return res.json();
}

async function apiReset(type: MessageTemplateType): Promise<MessageTemplate> {
  const res = await fetch(`/api/backend/message-templates/${type}/reset`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al restaurar plantilla");
  return res.json();
}

export function MessageTemplatesTab({
  initialTemplates,
}: MessageTemplatesTabProps) {
  const [templates, setTemplates] =
    useState<MessageTemplate[]>(initialTemplates);
  const [expanded, setExpanded] = useState<MessageTemplateType | null>(null);
  const [, startTransition] = useTransition();

  function getTemplate(type: MessageTemplateType): MessageTemplate {
    return (
      templates.find((t) => t.messageType === type) ?? {
        messageType: type,
        body: DEFAULT_TEMPLATE_BODIES[type],
        isEnabled: true,
        isDefault: true,
      }
    );
  }

  function updateTemplate(updated: MessageTemplate) {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.messageType !== updated.messageType);
      return [...next, updated];
    });
  }

  function handleToggleEnabled(type: MessageTemplateType, enabled: boolean) {
    const tpl = getTemplate(type);
    startTransition(async () => {
      const updated = await apiUpsert(type, tpl.body, enabled);
      updateTemplate(updated);
    });
  }

  function toggleExpanded(type: MessageTemplateType) {
    setExpanded((prev) => (prev === type ? null : type));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Personalizá los mensajes que se envían automáticamente por WhatsApp.
          Las variables entre llaves dobles{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {"{{variable}}"}
          </code>{" "}
          se reemplazan con datos reales al enviar.
        </p>
      </div>

      <div className="space-y-3">
        {TEMPLATE_META.map((meta) => {
          const tpl = getTemplate(meta.type);
          const isOpen = expanded === meta.type;

          return (
            <Card
              key={meta.type}
              className={cn(
                "transition-all duration-200",
                !tpl.isEnabled && "opacity-60",
              )}
            >
              {/* Card header — always visible */}
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <Switch
                    checked={tpl.isEnabled}
                    onCheckedChange={(val) =>
                      handleToggleEnabled(meta.type, val)
                    }
                    className="mt-0.5 flex-shrink-0"
                  />

                  {/* Info — clickable to expand */}
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => toggleExpanded(meta.type)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{meta.icon}</span>
                      <CardTitle className="text-base font-semibold">
                        {meta.label}
                      </CardTitle>
                      {tpl.isDefault ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Predeterminado
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0 dark:bg-blue-950/40 dark:text-blue-300"
                        >
                          Personalizado
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1 text-xs">
                      {meta.description}
                    </CardDescription>
                  </button>

                  {/* Expand toggle icon */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(meta.type)}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </CardHeader>

              {/* Expanded editor */}
              {isOpen && (
                <CardContent className="pt-0 border-t">
                  <div className="pt-4">
                    <TemplateEditor
                      meta={meta}
                      template={tpl}
                      defaultBody={DEFAULT_TEMPLATE_BODIES[meta.type]}
                      onSave={async (body, isEnabled) => {
                        const updated = await apiUpsert(
                          meta.type,
                          body,
                          isEnabled,
                        );
                        updateTemplate(updated);
                      }}
                      onReset={async () => {
                        const updated = await apiReset(meta.type);
                        updateTemplate(updated);
                      }}
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
