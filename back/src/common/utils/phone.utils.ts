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

/** Compara dos teléfonos normalizados; acepta variantes con/sin 9 móvil AR (549 vs 54). */
export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) {
    const tailA = da.slice(-10);
    const tailB = db.slice(-10);
    if (tailA === tailB) return true;
  }
  return false;
}
