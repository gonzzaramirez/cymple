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
import { sileo } from "sileo";

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

export function WhatsappConnectionCard() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/backend/whatsapp/status", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as StatusPayload;
  }, []);

  const refresh = useCallback(async () => {
    const s = await fetchStatus();
    if (s) setStatus(s);
    return s;
  }, [fetchStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const transient =
      status?.uiStatus === "connecting" ||
      status?.uiStatus === "qr" ||
      status?.uiStatus === "error";

    if (transient) {
      pollRef.current = setInterval(() => {
        void refresh();
      }, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return undefined;
  }, [status?.uiStatus, refresh]);

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
            typeof body.message === "string" ?
              body.message
            : "No se pudo iniciar WhatsApp",
        });
        await refresh();
        return;
      }
      sileo.success({
        title: typeof body.message === "string" ? body.message : "Iniciando…",
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
      const res = await fetch("/api/backend/whatsapp/logout", {
        method: "POST",
      });
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

  const label =
    status === null ?
      "Cargando…"
    : status.uiStatus === "ready" ? "Conectado"
    : status.uiStatus === "qr" ? "Escaneá el QR"
    : status.uiStatus === "connecting" ? "Conectando…"
    : status.uiStatus === "error" ? "Error"
    : "Desconectado";

  const showQr = status?.uiStatus === "qr" && status.qr;
  const src = qrSrc(showQr ? status.qr : null);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          WhatsApp (Evolution API)
        </CardTitle>
        <CardDescription>
          Vinculá tu número para enviar confirmaciones y recordatorios. Estado:{" "}
          <span className="font-medium text-foreground">{label}</span>
          {status?.errorMessage ?
            ` — ${status.errorMessage}`
          : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {src ?
          <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-lg border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL del QR Evolution */}
            <img
              src={src}
              alt="Código QR WhatsApp"
              width={240}
              height={240}
              className="h-full w-full object-contain"
            />
          </div>
        : null}

        <div className="flex flex-wrap gap-2">
          {status?.uiStatus !== "ready" ?
            <Button
              type="button"
              size="lg"
              disabled={loading}
              onClick={() => void onConnect()}
            >
              {loading ? "Procesando…" : "Conectar WhatsApp"}
            </Button>
          : null}
          {status?.uiStatus === "ready" ?
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => void onLogout()}
            >
              Desconectar
            </Button>
          : null}
        </div>
      </CardContent>
    </Card>
  );
}
