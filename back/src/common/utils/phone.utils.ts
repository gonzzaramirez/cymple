import { Logger } from '@nestjs/common';

const phoneLogger = new Logger('PhoneUtils');

/** Dígitos solamente, sin + ni espacios (para Evolution `number`). */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normaliza a formato WhatsApp Argentina sin '+' (Evolution espera digits).
 * Reglas prácticas:
 * - Si empieza con 549: ok
 * - Si empieza con 54 y no tiene 9: inserta 9 -> 549...
 * - Si es 10/11 dígitos (sin 54): asume AR y antepone 549
 */
export function normalizeArWhatsappNumber(phone: string): string {
  const d = normalizePhoneDigits(phone);
  if (!d) return d;
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) {
    return `549${d.slice(2)}`;
  }
  if (d.length === 10 || d.length === 11) {
    return `549${d}`;
  }
  return d;
}

/**
 * Extrae el "núcleo" de un número argentino: el código de área + número local
 * sin prefijos internacionales ni el "9" del móvil.
 * Ejemplos:
 *   5493775479650 → 3775479650 (quita 549)
 *   5491137754796 → 1137754796 (quita 549, pero保留 el 11 de BA)
 *   3775479650    → 3775479650  (sin cambios)
 *   93775479650   → 3775479650  (quita el 9 del mobile)
 */
function extractCoreDigits(phone: string): string {
  let d = normalizePhoneDigits(phone);

  // Quitar prefijo de país 54 o 549
  if (d.startsWith('549')) {
    d = d.slice(3);
  } else if (d.startsWith('54')) {
    d = d.slice(2);
  }

  // Quitar el "9" del mobile Argentina si el número empieza con 9
  // y el número restante tiene 10 dígitos (formato: 9 + area + number)
  if (d.startsWith('9') && d.length === 11) {
    d = d.slice(1);
  }

  return d;
}

/**
 * Compara dos teléfonos normalizados con tolerancia para variantes argentinas.
 * Intenta múltiples estrategias de comparación:
 * 1. Match exacto de dígitos
 * 2. Match por últimos N dígitos (8, 9, 10)
 * 3. Match comparando el "core" del número (sin prefijos internacionales ni 9 móvil)
 */
export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);

  if (!da || !db) return false;

  // 1. Match exacto
  if (da === db) return true;

  // 2. Match por últimos N dígitos (fallback progresivo de 10 a 8)
  for (let len = 10; len >= 8; len--) {
    if (da.length >= len && db.length >= len) {
      if (da.slice(-len) === db.slice(-len)) {
        phoneLogger.debug(
          `phonesMatch: matched by last ${len} digits: ${da} vs ${db}`,
        );
        return true;
      }
    }
  }

  // 3. Match por "core" digits (sin 54/549/9 móvil)
  const coreA = extractCoreDigits(a);
  const coreB = extractCoreDigits(b);
  if (coreA && coreB && coreA === coreB) {
    phoneLogger.debug(
      `phonesMatch: matched by core digits: ${da}→${coreA} vs ${db}→${coreB}`,
    );
    return true;
  }

  // 4. Cross-compare core vs full
  // Ejemplo: DB tiene "3775479650" y JID tiene "5493775439981"
  // coreA = "3775479650", check if coreB ends with coreA or coreA ends with coreB
  if (coreA.length >= 8 && coreB.length >= 8) {
    const shortCore = coreA.length <= coreB.length ? coreA : coreB;
    const longCore = coreA.length > coreB.length ? coreA : coreB;
    if (
      longCore.endsWith(shortCore) ||
      shortCore.endsWith(longCore.slice(-8))
    ) {
      phoneLogger.debug(
        `phonesMatch: matched by core suffix: coreA=${coreA} coreB=${coreB}`,
      );
      return true;
    }
  }

  phoneLogger.debug(`phonesMatch: no match between ${da} and ${db}`);
  return false;
}
