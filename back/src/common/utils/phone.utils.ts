import { Logger } from '@nestjs/common';

const phoneLogger = new Logger('PhoneUtils');

/** Ofusca un número de teléfono para logs y notificaciones (ej: 549377****50). */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

/** Dígitos solamente, sin + ni espacios (para Evolution `number`). */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normaliza un número de teléfono al formato canónico WhatsApp Argentina: 549XXXXXXXXX.
 *
 * Limpia agresivamente prefijos comunes:
 *  - 549/54 (código país) → los quita y reconstruye con 549
 *  - 0 delante del código de área (larga distancia) → lo quita
 *  - 9 indicativo móvil internacional → lo quita
 *  - 15 prefijo móvil local → lo quita (al inicio y entre código de área y abonado)
 *
 * Ejemplos:
 *  5493775479650   → 5493775479650  (ya canónico)
 *  54903775479650  → 5493775479650  (quita 0 del código de área)
 *  549377515479650 → 5493775479650  (quita 15 intercalado)
 *  93775479650     → 5493775479650  (quita 9 móvil)
 *  03775479650     → 5493775479650  (quita 0 larga distancia)
 *  1547965000      → 54947965000    (quita 15 móvil local)
 */
export function normalizeArWhatsappNumber(phone: string): string {
  let d = normalizePhoneDigits(phone);
  if (!d) return '';

  // 1. Quitar prefijo internacional +54 o +549
  if (d.startsWith('549')) {
    d = d.slice(3);
  } else if (d.startsWith('54')) {
    d = d.slice(2);
  }

  // 2. Quitar 0 de larga distancia (ej: 03775... → 3775...)
  if (d.startsWith('0')) {
    d = d.slice(1);
  }

  // 3. Quitar 9 indicativo móvil internacional (ej: 93775... → 3775...)
  //    Solo si el resultado sigue teniendo ≥ 8 dígitos (número local válido)
  if (d.startsWith('9') && d.length >= 9) {
    d = d.slice(1);
  }

  // 4. Quitar 15 prefijo móvil local al inicio (ej: 154796... → 4796...)
  //    Solo si el resultado sigue teniendo ≥ 8 dígitos
  if (d.startsWith('15') && d.length > 9) {
    d = d.slice(2);
  }

  // 5. Quitar 15 intercalado entre código de área y número de abonado
  //    Si el número local tiene más de 11 dígitos, el exceso suele ser un 15
  //    Pattern: (2-4 dígitos de área)(15)(6-8 dígitos de abonado)
  //    Ej: 377515479650 → 3775 es área, 15, 479650 abonado → 3775479650
  if (d.length > 11) {
    d = d.replace(/^(\d{2,4})15/, '$1');
  }

  // 6. Reconstruir formato canónico 549 + número local
  const result = `549${d}`;

  // 7. Validación: número argentino canónico = 549 + 10-11 dígitos (13-14 total)
  if (!/^549\d{10,12}$/.test(result)) {
    phoneLogger.warn(
      `normalizeArWhatsappNumber: resultado inesperado ${maskPhone(result)} (longitud ${result.length})`,
    );
  }

  return result;
}

/**
 * Compara dos teléfonos normalizando ambos al formato canónico 549XXXXXXXXX.
 * Elimina el riesgo de colisiones por últimos N dígitos.
 *
 * Estrategia:
 *  1. Normalizar ambos al formato canónico y comparar igualdad exacta
 *  2. Comparar núcleos (sin 549) como fallback por si hubo diferencias
 *     en cómo se almacenó el número originalmente
 */
export function phonesMatch(a: string, b: string): boolean {
  const na = normalizeArWhatsappNumber(a);
  const nb = normalizeArWhatsappNumber(b);

  if (!na || !nb) return false;

  // 1. Match exacto con formato canónico
  if (na === nb) return true;

  // 2. Match por núcleo (área + abonado sin prefijo país)
  const coreA = na.slice(3);
  const coreB = nb.slice(3);
  if (coreA && coreB && coreA === coreB) {
    phoneLogger.debug(
      `phonesMatch: matched by core: ${maskPhone(na)} ↔ ${maskPhone(nb)}`,
    );
    return true;
  }

  phoneLogger.debug(
    `phonesMatch: no match between ${maskPhone(na)} and ${maskPhone(nb)}`,
  );
  return false;
}
