/** Utilidades defensivas: Evolution cambia forma del payload según versión. */

import { Logger } from '@nestjs/common';

const log = new Logger('EvolutionWebhookUtil');

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function extractInstanceName(payload: unknown): string | undefined {
  const root = asRecord(payload);
  if (!root) return undefined;
  const direct = root.instance ?? root.instanceName;
  if (typeof direct === 'string') return direct;
  const data = asRecord(root.data);
  if (data) {
    const d = data.instanceName ?? data.instance;
    if (typeof d === 'string') return d;
  }
  return undefined;
}

/** Parte local del JID antes de @, solo dígitos (número de usuario en WA). */
function digitsFromJidUser(jid: string): string {
  const at = jid.indexOf('@');
  const user = at >= 0 ? jid.slice(0, at) : jid;
  return user.replace(/\D/g, '');
}

/**
 * Con WhatsApp "LID", `remoteJid` viene como `...@lid` y NO es el teléfono.
 * El número real suele ir en `remoteJidAlt` (`...@s.whatsapp.net`).
 */
function resolveSenderDigits(key: Record<string, unknown>): string | null {
  const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  const remoteJidAlt =
    typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : '';
  const participant =
    typeof key.participant === 'string' ? key.participant : '';

  if (remoteJidAlt.includes('@s.whatsapp.net')) {
    return digitsFromJidUser(remoteJidAlt);
  }
  if (remoteJid.includes('@s.whatsapp.net')) {
    return digitsFromJidUser(remoteJid);
  }
  if (participant.includes('@s.whatsapp.net')) {
    return digitsFromJidUser(participant);
  }

  // Sin @s.whatsapp.net: no podemos cruzar con el paciente por teléfono
  if (remoteJid.includes('@lid')) {
    log.debug(
      `Mensaje solo con @lid y sin remoteJidAlt @s.whatsapp.net; no se puede resolver teléfono`,
    );
  }
  return null;
}

function textFromMessageContent(
  message: Record<string, unknown>,
): string | undefined {
  const conv = message.conversation;
  if (typeof conv === 'string') return conv;
  const ext = asRecord(message.extendedTextMessage);
  if (ext && typeof ext.text === 'string') return ext.text;

  const ephem = asRecord(message.ephemeralMessage);
  if (ephem) {
    const inner = asRecord(ephem.message);
    if (inner) return textFromMessageContent(inner);
  }
  const viewOnce = asRecord(message.viewOnceMessage);
  if (viewOnce) {
    const inner = asRecord(viewOnce.message);
    if (inner) return textFromMessageContent(inner);
  }
  return undefined;
}

function textFromMessage(msg: Record<string, unknown>): string | undefined {
  const message = asRecord(msg.message);
  if (!message) return undefined;
  return textFromMessageContent(message);
}

function messageLooksLikeInbound(msg: Record<string, unknown>): boolean {
  const key = asRecord(msg.key);
  if (!key) return false;
  return key.fromMe !== true;
}

function firstInboundMessage(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;

  const tryPaths: unknown[] = [
    root.data,
    root.body,
    asRecord(root.data)?.messages,
    asRecord(root.data)?.message,
    root.message,
  ];

  for (const p of tryPaths) {
    const arr = Array.isArray(p) ? p : null;
    if (arr?.[0]) {
      const m = asRecord(arr[0]);
      if (m?.key && messageLooksLikeInbound(m)) return m;
    }
    const rec = asRecord(p);
    if (rec?.messages && Array.isArray(rec.messages)) {
      for (const item of rec.messages) {
        const m = asRecord(item);
        if (m?.key && messageLooksLikeInbound(m)) return m;
      }
    }
  }

  const data = asRecord(root.data);
  if (data?.messages && Array.isArray(data.messages)) {
    for (const item of data.messages) {
      const m = asRecord(item);
      if (m?.key && messageLooksLikeInbound(m)) return m;
    }
  }

  // Evolution v2: un solo mensaje en { data: { key, message } }
  if (data?.key && data?.message && messageLooksLikeInbound(data)) {
    return data;
  }

  return null;
}

export function extractInboundText(payload: unknown): {
  text: string;
  fromJid: string;
} | null {
  const msg = firstInboundMessage(payload);
  if (!msg) return null;

  const key = asRecord(msg.key);
  if (!key) return null;

  const fromMe = key.fromMe === true;
  if (fromMe) return null;

  const digits = resolveSenderDigits(key);
  if (!digits) return null;

  const text = textFromMessage(msg);
  if (typeof text !== 'string' || !text.trim()) return null;

  return { text: text.trim(), fromJid: digits };
}
