import { DateTime, IANAZone } from 'luxon';

export const FALLBACK_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Lunes 00:00:00.000 → domingo 23:59:59.999 en la zona indicada (semana ISO). */
function startOfIsoWeek(dt: DateTime): DateTime {
  const day = dt.weekday;
  return dt.startOf('day').minus({ days: day - 1 });
}

function endOfIsoWeek(dt: DateTime): DateTime {
  return startOfIsoWeek(dt).plus({ days: 6 }).endOf('day');
}

/**
 * Rangos de calendario alineados a la zona del profesional (no UTC puro).
 * Los turnos se guardan con instantes coherentes con horario local de trabajo;
 * el filtro debe usar la misma semana/día/mes “civil” en esa TZ.
 */
/** Fecha civil yyyy-MM-dd en la zona (para agrupar turnos en el gráfico semanal). */
export function calendarDateKeyInTimeZone(
  instant: Date,
  timeZone: string,
): string {
  const zone = IANAZone.isValidZone(timeZone) ? timeZone : FALLBACK_TIMEZONE;
  return DateTime.fromJSDate(instant).setZone(zone).toFormat('yyyy-MM-dd');
}

export function resolveCalendarRangeInTimeZone(
  view: 'day' | 'week' | 'month',
  anchor: Date,
  timeZone: string,
): { start: Date; end: Date } {
  const zone = IANAZone.isValidZone(timeZone) ? timeZone : FALLBACK_TIMEZONE;
  const dt = DateTime.fromJSDate(anchor).setZone(zone);

  if (view === 'day') {
    const start = dt.startOf('day');
    const end = dt.endOf('day');
    return { start: start.toJSDate(), end: end.toJSDate() };
  }

  if (view === 'month') {
    const start = dt.startOf('month');
    const end = dt.endOf('month');
    return { start: start.toJSDate(), end: end.toJSDate() };
  }

  const start = startOfIsoWeek(dt);
  const end = endOfIsoWeek(dt);
  return { start: start.toJSDate(), end: end.toJSDate() };
}
