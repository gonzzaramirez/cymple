"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  LoaderCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  label: string;
  content: Record<string, unknown>;
};

type ClinicalRichTextEditorProps = {
  initialContent?: Record<string, unknown> | null;
  placeholder?: string;
  templates?: Template[];
  debounceMs?: number;
  onSave: (payload: {
    content: Record<string, unknown>;
    plainTextPreview: string;
  }) => Promise<void>;
};

const DEFAULT_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
} satisfies Record<string, unknown>;

function toPlainText(json: Record<string, unknown>): string {
  const walk = (node: unknown): string => {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(walk).join(" ");
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text : "";
      return `${text} ${walk(record.content)}`.trim();
    }
    return "";
  };
  return walk(json).replace(/\s+/g, " ").trim().slice(0, 500);
}

export function ClinicalRichTextEditor({
  initialContent,
  placeholder = "Escribí aquí...",
  templates = [],
  debounceMs = 1500,
  onSave,
}: ClinicalRichTextEditorProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedContentRef = useRef<string>("");
  const content = useMemo(
    () => initialContent ?? DEFAULT_DOC,
    [initialContent],
  );
  const initialSerializedContent = useMemo(() => JSON.stringify(content), [content]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "min-h-36 rounded-b-xl border border-t-0 border-border bg-background px-3 py-3 text-sm outline-none",
      },
      transformPastedText(text) {
        return text.replace(/\t/g, " ").replace(/\s+\n/g, "\n");
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content);
    lastSavedContentRef.current = initialSerializedContent;
  }, [content, editor]);

  const debouncedSave = useDebouncedCallback(async () => {
    if (!editor) return;
    const json = editor.getJSON() as Record<string, unknown>;
    const serialized = JSON.stringify(json);
    if (serialized === lastSavedContentRef.current) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    try {
      await onSave({
        content: json,
        plainTextPreview: toPlainText(json),
      });
      lastSavedContentRef.current = serialized;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, debounceMs);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      setSaveState("idle");
      void debouncedSave();
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, debouncedSave]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-border bg-muted/40 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8", editor.isActive("bold") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8", editor.isActive("heading", { level: 2 }) && "bg-muted")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8", editor.isActive("heading", { level: 3 }) && "bg-muted")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8", editor.isActive("bulletList") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8", editor.isActive("orderedList") && "bg-muted")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </Button>
        {templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => editor.commands.setContent(template.content)}
          >
            {template.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <>
              <LoaderCircle className="size-3 animate-spin" />
              Guardando...
            </>
          )}
          {saveState === "saved" && (
            <>
              <Save className="size-3" />
              Guardado
            </>
          )}
          {saveState === "error" && "Error al guardar"}
          {saveState === "idle" && "Listo"}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
