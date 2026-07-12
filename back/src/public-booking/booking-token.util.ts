import * as crypto from 'crypto';

/**
 * Genera un token único para reservas públicas.
 * Usa un fragmento de UUID en lugar de secuencial para evitar
 * colisiones por race condition entre reservas simultáneas.
 */
export async function generateBookingToken(): Promise<string> {
  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase();
  return `R-${randomPart}`;
}

export function extractBookingToken(text: string): string | null {
  const match = text.match(/R-([a-f0-9]+)/i);
  return match ? match[0].toUpperCase() : null;
}
