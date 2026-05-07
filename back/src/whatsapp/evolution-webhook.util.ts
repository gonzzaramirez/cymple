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

  const direct =
    root.instance ?? root.instanceName ?? root.owner ?? root.instanceId;
  if (typeof direct === 'string') return direct;

  const data = asRecord(root.data);
  if (data) {
    const d =
      data.instanceName ?? data.instance ?? data.owner ?? data.instanceId;
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
 * En versiones modernas, el @lid contiene dígitos que podemos intentar usar.
 */
function resolveSenderDigits(key: Record<string, unknown>): string | null {
  const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  const remoteJidAlt =
    typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : '';
  const participant =
    typeof key.participant === 'string' ? key.participant : '';

  // Prioridad 1: remoteJidAlt con @s.whatsapp.net (número real en LID mode)
  if (remoteJidAlt.includes('@s.whatsapp.net')) {
    const digits = digitsFromJidUser(remoteJidAlt);
    log.debug(`Sender resolved from remoteJidAlt: ${digits}`);
    return digits;
  }

  // Prioridad 2: remoteJid con @s.whatsapp.net
  if (remoteJid.includes('@s.whatsapp.net')) {
    const digits = digitsFromJidUser(remoteJid);
    log.debug(`Sender resolved from remoteJid: ${digits}`);
    return digits;
  }

  // Prioridad 3: participant (grupos)
  if (participant.includes('@s.whatsapp.net')) {
    const digits = digitsFromJidUser(participant);
    log.debug(`Sender resolved from participant: ${digits}`);
    return digits;
  }

  // Fallback LID: en versiones modernas de WhatsApp, el @lid puede contener dígitos utilizables
  if (remoteJid.includes('@lid')) {
    const lidDigits = digitsFromJidUser(remoteJid);
    if (lidDigits.length >= 8) {
      log.debug(`Sender resolved from @lid digits (fallback): ${lidDigits}`);
      return lidDigits;
    }
    log.warn(
      `Mensaje solo con @lid (${remoteJid}) sin remoteJidAlt — dígitos extraídos: ${lidDigits || 'ninguno'}`,
    );
  }

  log.warn(
    `No se pudo resolver sender digits: remoteJid=${remoteJid}, remoteJidAlt=${remoteJidAlt}, participant=${participant}`,
  );
  return null;
}

function textFromMessageContent(
  message: Record<string, unknown>,
): string | undefined {
  // Texto plano
  const conv = message.conversation;
  if (typeof conv === 'string') return conv;

  // Texto extendido
  const ext = asRecord(message.extendedTextMessage);
  if (ext && typeof ext.text === 'string') return ext.text;

  // Button reply (respuesta interactiva por botón)
  const btn = asRecord(message.buttonsResponseMessage);
  if (btn) {
    const btnText = btn.selectedDisplayText ?? btn.selectedButtonId;
    if (typeof btnText === 'string') return btnText;
    // Algunos envían selectedButtonId como texto del botón
    const btnBody = asRecord(btn.selectedButtonId);
    if (typeof btnBody === 'string') return btnBody;
  }

  // List reply (respuesta por lista interactiva)
  const list = asRecord(message.listResponseMessage);
  if (list) {
    const listText = list.title ?? list.description ?? list.singleSelectReply;
    if (typeof listText === 'string') return listText;
  }

  // Template button reply
  const tplBtn = asRecord(message.templateButtonReplyMessage);
  if (tplBtn && typeof tplBtn.selectedDisplayText === 'string')
    return tplBtn.selectedDisplayText;

  // Ephemeral / viewOnce (recursivo)
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
  if (!root) {
    log.debug('Payload no es un objeto');
    return null;
  }

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

  // Evolution v3: { event: "messages.upsert", data: { key: ..., message: ... } }
  const event = asRecord(root.event);
  if (event) {
    return firstInboundMessage(event);
  }

  log.debug(
    `No inbound message found. Payload keys: ${
      root ? Object.keys(root).slice(0, 10).join(', ') : 'none'
    }`,
  );
  return null;
}

const NON_TEXT_TYPES = [
  'audioMessage',
  'imageMessage',
  'videoMessage',
  'stickerMessage',
  'documentMessage',
  'contactMessage',
  'locationMessage',
  'call',
  'protocolMessage',
  'reactionMessage',
];

export function extractInboundText(payload: unknown): {
  text: string;
  fromJid: string;
} | null {
  const msg = firstInboundMessage(payload);
  if (!msg) {
    log.debug(
      'firstInboundMessage retornó null — sin mensaje entrante en payload',
    );
    return null;
  }

  const key = asRecord(msg.key);
  if (!key) {
    log.debug('msg.key no es un objeto — no se puede extraer fromJid');
    return null;
  }

  const fromMe = key.fromMe === true;
  if (fromMe) {
    log.debug('Mensaje ignorado: es un eco saliente (fromMe=true)');
    return null;
  }

  const digits = resolveSenderDigits(key);
  if (!digits) {
    log.warn('No se pudieron resolver dígitos del remitente');
    return null;
  }

  const text = textFromMessage(msg);
  if (typeof text !== 'string' || !text.trim()) {
    const message = asRecord(asRecord(msg)?.message ?? {});
    const found = message
      ? NON_TEXT_TYPES.find((t) => message[t] !== undefined)
      : undefined;
    if (found) {
      log.log(`Non-text message received — type: ${found}, from: ${digits}`);
    } else {
      log.debug(
        `textFromMessage retornó ${typeof text === 'string' ? 'vacío' : typeof text} — possible LID/non-text/fromMe`,
      );
    }
    return null;
  }

  log.debug(`Texto extraído exitosamente: "${text.trim().substring(0, 80)}"`);
  return { text: text.trim(), fromJid: digits };
}
