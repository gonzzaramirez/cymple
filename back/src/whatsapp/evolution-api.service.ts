import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REQUEST_MS = 15_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export class EvolutionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Evolution API HTTP ${status}`);
    this.name = 'EvolutionApiError';
  }
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (this.config.get<string>('EVOLUTION_API_URL') ?? '').replace(
      /\/$/,
      '',
    );
  }

  private apiKey(): string {
    return this.config.get<string>('EVOLUTION_API_KEY') ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl() && this.apiKey());
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object,
  ): Promise<T> {
    const base = this.baseUrl();
    const key = this.apiKey();
    if (!base || !key) {
      throw new Error('Evolution API no configurada (EVOLUTION_API_URL / KEY)');
    }

    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_MS);

      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            apikey: key,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const text = await res.text();
        let data: unknown = {};
        if (text) {
          try {
            data = JSON.parse(text) as unknown;
          } catch {
            data = { raw: text };
          }
        }

        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          const backoff = Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, 10_000);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (!res.ok) {
          throw new EvolutionApiError(res.status, data);
        }

        return data as T;
      } catch (e) {
        lastError = e;
        if (e instanceof EvolutionApiError) throw e;

        if (attempt < MAX_RETRIES) {
          const backoff = Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, 10_000);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('Evolution API request failed after retries');
  }

  async getConnectionState(instanceName: string): Promise<string | undefined> {
    const data = await this.request<Record<string, unknown>>(
      'GET',
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    );
    const state =
      dig(data, ['instance', 'state']) ??
      dig(data, ['state']) ??
      dig(data, ['instance', 'instance', 'state']);
    return typeof state === 'string' ? state.toLowerCase() : undefined;
  }

  async createInstance(
    instanceName: string,
    webhookUrl?: string,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    };
    if (webhookUrl) {
      const webhookConfig: Record<string, unknown> = {
        url: webhookUrl,
        webhook_by_events: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      };
      const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
      if (token) {
        webhookConfig.headers = {
          'x-evolution-webhook-token': token,
        };
      }
      body.webhook = webhookConfig;
    }
    return this.request<Record<string, unknown>>(
      'POST',
      '/instance/create',
      body,
    );
  }

  async connect(instanceName: string): Promise<Record<string, unknown>> {
    const path = `/instance/connect/${encodeURIComponent(instanceName)}`;
    try {
      return await this.request<Record<string, unknown>>('POST', path, {});
    } catch (e) {
      // Compatibilidad entre versiones de Evolution:
      // algunas exponen connect por GET y devuelven "Cannot POST /instance/connect/...".
      if (e instanceof EvolutionApiError) {
        const body = JSON.stringify(e.body).toLowerCase();
        const cannotPost = e.status === 404 && body.includes('cannot post');
        if (cannotPost) {
          return this.request<Record<string, unknown>>('GET', path);
        }
      }
      throw e;
    }
  }

  async logout(instanceName: string): Promise<void> {
    await this.request(
      'DELETE',
      `/instance/logout/${encodeURIComponent(instanceName)}`,
    );
  }

  async sendText(
    instanceName: string,
    numberDigits: string,
    text: string,
    options?: { delay?: number },
  ) {
    return this.request<Record<string, unknown>>(
      'POST',
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        number: numberDigits,
        text,
        options: {
          delay: options?.delay ?? 6000,
          presence: 'composing',
        },
      },
    );
  }

  async setWebhook(
    instanceName: string,
    webhookUrl: string,
  ): Promise<Record<string, unknown>> {
    const webhookBody: Record<string, unknown> = {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    };
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (token) {
      webhookBody.headers = {
        'x-evolution-webhook-token': token,
      };
    }
    return this.request<Record<string, unknown>>(
      'POST',
      `/webhook/set/${encodeURIComponent(instanceName)}`,
      { enabled: true, webhook: webhookBody },
    );
  }
}

/** Extrae QR base64 de respuestas create/connect/status Evolution (formas variables). */
export function extractQrBase64(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;

  const direct = o.base64 ?? o.qrcode;
  if (typeof direct === 'string' && direct.length > 50) return direct;

  const qrcode = o.qrcode;
  if (qrcode && typeof qrcode === 'object') {
    const q = qrcode as Record<string, unknown>;
    const b = q.base64;
    if (typeof b === 'string') return b;
  }

  const nested = dig(data, ['qrcode', 'base64']);
  if (typeof nested === 'string') return nested;

  return undefined;
}
