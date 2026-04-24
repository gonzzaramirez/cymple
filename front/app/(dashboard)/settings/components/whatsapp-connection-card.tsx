"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sileo } from "sileo";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  QrCode,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UiStatus = "disconnected" | "connecting" | "qr" | "ready" | "error";

type StatusPayload = {
  uiStatus: UiStatus;
  qr: string | null;
  dbStatus: string;
  errorMessage?: string;
};

function qrSrc(base64: string | null): string | null {
  if (!base64) return null;
  if (base64.startsWith("data:image")) return base64;
  return `data:image/png;base64,${base64}`;
}

type StatusConfig = {
  label: string;
  icon: React.ReactNode;
  dotClass: string;
  descriptionHint: string;
};

function getStatusConfig(uiStatus: UiStatus | null, apiError: boolean): StatusConfig {
  if (apiError) {
    return {
      label: "Sin conexión con el servidor",
      icon: <WifiOff className="size-3.5" />,
      dotClass: "bg-destructive",
      descriptionHint: "No se pudo contactar al servidor. Reintentando automáticamente...",
    };
  }
  if (uiStatus === null) {
    return {
      label: "Verificando...",
      icon: <Loader2 className="size-3.5 animate-spin" />,
      dotClass: "bg-muted-foreground",
      descriptionHint: "Consultando estado de la conexión",
    };
  }
  switch (uiStatus) {
    case "ready":
      return {
        label: "Conectado",
        icon: <CheckCircle2 className="size-3.5" />,
        dotClass: "bg-green-500",
        descriptionHint: "WhatsApp está activo y enviando mensajes",
      };
    case "qr":
      return {
        label: "Escaneá el QR",
        icon: <QrCode className="size-3.5" />,
        dotClass: "bg-amber-500 animate-pulse",
        descriptionHint: "Abrí WhatsApp en tu celular → Dispositivos vinculados → Vincular",
      };
    case "connecting":
      return {
        label: "Conectando...",
        icon: <Loader2 className="size-3.5 animate-spin" />,
        dotClass: "bg-amber-500 animate-pulse",
        descriptionHint: "Estableciendo conexión con WhatsApp",
      };
    case "error":
      return {
        label: "Error de conexión",
        icon: <AlertCircle className="size-3.5" />,
        dotClass: "bg-destructive animate-pulse",
        descriptionHint: "Ocurrió un error. Revisá el mensaje y reintentá.",
      };
    case "disconnected":
    default:
      return {
        label: "Desconectado",
        icon: <Circle className="size-3.5" />,
        dotClass: "bg-muted-foreground/50",
        descriptionHint: "Conectá tu número para enviar confirmaciones y recordatorios",
      };
  }
}

export function WhatsappConnectionCard() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [apiError, setApiError] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (): Promise<StatusPayload | null> => {
    try {
      const res = await fetch("/api/backend/whatsapp/status", { cache: "no-store" });
      if (!res.ok) {
        setApiError(true);
        return null;
      }
      setApiError(false);
      return (await res.json()) as StatusPayload;
    } catch {
      setApiError(true);
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const s = await fetchStatus();
    if (s) setStatus(s);
    return s;
  }, [fetchStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const shouldPoll =
      apiError ||
      status?.uiStatus === "connecting" ||
      status?.uiStatus === "qr" ||
      status?.uiStatus === "error";

    if (shouldPoll) {
      pollRef.current = setInterval(() => { void refresh(); }, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return undefined;
  }, [status?.uiStatus, apiError, refresh]);

  async function onConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/backend/whatsapp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        sileo.error({
          title:
            typeof body.message === "string"
              ? body.message
              : "No se pudo iniciar WhatsApp",
        });
        await refresh();
        return;
      }
      sileo.success({
        title: typeof body.message === "string" ? body.message : "Iniciando...",
      });
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const s = await fetchStatus();
        if (s) {
          setStatus(s);
          if (s.uiStatus === "ready" || s.uiStatus === "qr") break;
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    if (!confirm("¿Desconectar WhatsApp en este consultorio?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/backend/whatsapp/logout", { method: "POST" });
      if (!res.ok) {
        sileo.error({ title: "No se pudo desconectar" });
        return;
      }
      sileo.success({ title: "WhatsApp desconectado" });
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  const cfg = getStatusConfig(status?.uiStatus ?? null, apiError);
  const showQr = !apiError && status?.uiStatus === "qr" && status.qr;
  const src = qrSrc(showQr ? status!.qr : null);
  const hasError =
    !apiError && (status?.uiStatus === "error") && status?.errorMessage;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              WhatsApp (Evolution API)
            </CardTitle>
            <CardDescription className="mt-1">
              {cfg.descriptionHint}
            </CardDescription>
          </div>

          <div
            className={cn(
              "mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              apiError || status?.uiStatus === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : status?.uiStatus === "ready"
                  ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                  : status?.uiStatus === "qr" || status?.uiStatus === "connecting"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-border bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn("size-2 rounded-full", cfg.dotClass)}
              aria-hidden
            />
            {cfg.label}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error de WhatsApp</AlertTitle>
            <AlertDescription>{status!.errorMessage}</AlertDescription>
          </Alert>
        )}

        {apiError && (
          <Alert variant="destructive">
            <WifiOff className="size-4" />
            <AlertTitle>No se pudo conectar con el servidor</AlertTitle>
            <AlertDescription>
              Verificá que el servidor esté activo. Se reintentará automáticamente
              cada 5 segundos.
            </AlertDescription>
          </Alert>
        )}

        {src && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Abrí WhatsApp → <strong>Dispositivos vinculados</strong> →{" "}
              <strong>Vincular un dispositivo</strong> → escaneá este código
            </p>
            <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL del QR Evolution */}
              <img
                src={src}
                alt="Código QR WhatsApp"
                width={220}
                height={220}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status?.uiStatus !== "ready" && !apiError && (
            <Button
              type="button"
              size="lg"
              disabled={loading || status?.uiStatus === "connecting"}
              onClick={() => void onConnect()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Conectar WhatsApp"
              )}
            </Button>
          )}

          {(apiError || status?.uiStatus === "error") && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw className="mr-2 size-4" />
              Reintentar
            </Button>
          )}

          {status?.uiStatus === "ready" && !apiError && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => void onLogout()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Desconectar"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
