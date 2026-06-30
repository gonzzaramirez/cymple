"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WhatsappPreview } from "./whatsapp-preview";
import { TemplateMeta } from "@/lib/message-templates";
import { MessageTemplate } from "@/lib/types";

interface TemplateEditorProps {
  meta: TemplateMeta;
  template: MessageTemplate;
  defaultVariants: [string, string, string];
  onSave: (
    bodies: { body: string; bodyV2: string; bodyV3: string },
    isEnabled: boolean,
  ) => Promise<void>;
  onReset: () => Promise<void>;
}

export function TemplateEditor({
  meta,
  template,
  defaultVariants,
  onSave,
  onReset,
}: TemplateEditorProps) {
  const previewTime = useMemo(
    () =>
      new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [],
  );

  const [variantTab, setVariantTab] = useState("v0");
  const [bodyV0, setBodyV0] = useState(template.body);
  const [bodyV1, setBodyV1] = useState(template.bodyV2 ?? defaultVariants[1]);
  const [bodyV2, setBodyV2] = useState(template.bodyV3 ?? defaultVariants[2]);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allBodies = [bodyV0, bodyV1, bodyV2];
  const currentBody = variantTab === "v0" ? bodyV0 : variantTab === "v1" ? bodyV1 : bodyV2;
  const allDefaults = [...defaultVariants];
  const isDirty =
    bodyV0 !== template.body ||
    bodyV1 !== (template.bodyV2 ?? defaultVariants[1]) ||
    bodyV2 !== (template.bodyV3 ?? defaultVariants[2]);
  const isDefault =
    bodyV0 === defaultVariants[0] &&
    bodyV1 === defaultVariants[1] &&
    bodyV2 === defaultVariants[2];

  function setBodyForTab(value: string) {
    if (variantTab === "v0") setBodyV0(value);
    else if (variantTab === "v1") setBodyV1(value);
    else setBodyV2(value);
    setSaved(false);
  }

  function insertVariable(key: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? currentBody.length;
    const end = el.selectionEnd ?? currentBody.length;
    const tag = `{{${key}}}`;
    const next = currentBody.slice(0, start) + tag + currentBody.slice(end);
    setBodyForTab(next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  function handleSave() {
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await onSave(
          { body: bodyV0, bodyV2: bodyV1, bodyV3: bodyV2 },
          template.isEnabled,
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        setSaveError("Error al guardar. Intentá de nuevo.");
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      await onReset();
      setBodyV0(defaultVariants[0]);
      setBodyV1(defaultVariants[1]);
      setBodyV2(defaultVariants[2]);
      setSaved(false);
    });
  }

  return (
    <div className="space-y-5">
      {/* Variant tabs */}
      <Tabs value={variantTab} onValueChange={(v) => setVariantTab(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="v0">
            Variante 1
            {bodyV0 !== (template.body ?? defaultVariants[0]) && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="v1">
            Variante 2
            {bodyV1 !== (template.bodyV2 ?? defaultVariants[1]) && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="v2">
            Variante 3
            {bodyV2 !== (template.bodyV3 ?? defaultVariants[2]) && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-500" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Variable chips (shared) */}
        <div className="my-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Variables disponibles — clic para insertar
          </p>
          <div className="flex flex-wrap gap-2">
            {meta.variables.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={`${v.description}\nEjemplo: ${v.example}`}
                className="group inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-mono text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
              >
                <span className="opacity-50 group-hover:opacity-100">{"{"}{"{"}{"}"}</span>
                {v.key}
              </button>
            ))}
          </div>
        </div>

        {/* Tab contents */}
        {["v0", "v1", "v2"].map((tab) => {
          const body = tab === "v0" ? bodyV0 : tab === "v1" ? bodyV1 : bodyV2;
          const setBody = (v: string) => {
            if (tab === "v0") setBodyV0(v);
            else if (tab === "v1") setBodyV1(v);
            else setBodyV2(v);
            setSaved(false);
          };

          return (
            <TabsContent key={tab} value={tab} className="mt-0 space-y-2">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Editor */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cuerpo del mensaje
                  </label>
                  <Textarea
                    ref={variantTab === tab ? textareaRef : undefined}
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                    }}
                    rows={10}
                    className="font-mono text-sm resize-none"
                    placeholder="Escribe el mensaje aquí. Usá los chips de arriba para insertar variables."
                  />
                  <p className="text-xs text-muted-foreground">
                    Usá *texto* para <strong>negrita</strong> y _texto_ para{" "}
                    <em>cursiva</em> — igual que WhatsApp.
                  </p>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Vista previa (con datos de ejemplo)
                  </p>
                  <WhatsappPreview
                    body={body}
                    sampleData={meta.sampleData}
                    previewTime={previewTime}
                  />
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          onClick={handleSave}
          disabled={isPending || !isDirty}
          size="sm"
        >
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>

        {!isDefault && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isPending}
          >
            Restaurar predeterminado
          </Button>
        )}

        {saved && (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          >
            ✓ Guardado (3 variantes)
          </Badge>
        )}
        {saveError && (
          <p className="text-xs text-destructive">{saveError}</p>
        )}
      </div>
    </div>
  );
}
