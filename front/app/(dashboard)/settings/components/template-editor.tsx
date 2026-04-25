"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WhatsappPreview } from "./whatsapp-preview";
import { TemplateMeta } from "@/lib/message-templates";
import { MessageTemplate } from "@/lib/types";

interface TemplateEditorProps {
  meta: TemplateMeta;
  template: MessageTemplate;
  defaultBody: string;
  onSave: (body: string, isEnabled: boolean) => Promise<void>;
  onReset: () => Promise<void>;
}

export function TemplateEditor({
  meta,
  template,
  defaultBody,
  onSave,
  onReset,
}: TemplateEditorProps) {
  const [body, setBody] = useState(template.body);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = body !== template.body;
  const isDefault = body === defaultBody;

  function insertVariable(key: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const tag = `{{${key}}}`;
    const next = body.slice(0, start) + tag + body.slice(end);
    setBody(next);
    setSaved(false);

    // Restore cursor position after React re-render
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
        await onSave(body, template.isEnabled);
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
      setBody(defaultBody);
      setSaved(false);
    });
  }

  return (
    <div className="space-y-5">
      {/* Variable chips */}
      <div className="space-y-2">
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

      {/* Editor + Preview side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cuerpo del mensaje
          </label>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
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
          <WhatsappPreview body={body} sampleData={meta.sampleData} />
        </div>
      </div>

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
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            ✓ Guardado
          </Badge>
        )}
        {saveError && (
          <p className="text-xs text-destructive">{saveError}</p>
        )}
      </div>
    </div>
  );
}
