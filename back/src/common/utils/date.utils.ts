export const ARG_TZ = 'America/Argentina/Buenos_Aires';

export function parseHourMinute(value: string): {
  hour: number;
  minute: number;
} {
  const [hourString, minuteString] = value.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Invalid time format: ${value}`);
  }
  return { hour, minute };
}

export function setTimeOnDate(baseDate: Date, time: string): Date {
  const { hour, minute } = parseHourMinute(time);
  const date = new Date(baseDate);
  date.setUTCHours(hour + 3, minute, 0, 0);
  return date;
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60000);
}

/**
 * Format a date-only field (@db.Date) for Spanish display.
 * Date-only fields are midnight UTC in JS — using timeZone: 'UTC' avoids
 * the off-by-one-day shift that Argentina TZ (UTC-3) would cause.
 * Example: "lunes 29 de junio de 2026"
 */
export function formatDateOnly(
  date: Date,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(date);
}

/**
 * Format a date-only field as short date string (DD/MM/YYYY) using UTC.
 */
export function formatDateOnlyShort(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${d}/${m}/${y}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function startOfMonth(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0),
  );
}

export function endOfMonth(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  );
}
