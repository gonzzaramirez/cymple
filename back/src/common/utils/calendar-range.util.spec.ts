import {
  resolveCalendarRangeInTimeZone,
  FALLBACK_TIMEZONE,
} from './calendar-range.util';

describe('resolveCalendarRangeInTimeZone', () => {
  const AR = 'America/Argentina/Buenos_Aires';

  it('semana: domingo por la noche en AR sigue siendo la misma semana ISO local', () => {
    // Domingo 19-abr-2026 ~20:00 ART — ancla “hoy” del usuario
    const anchor = new Date('2026-04-19T23:00:00.000Z');
    const { start, end } = resolveCalendarRangeInTimeZone('week', anchor, AR);

    // Turno domingo ~23:00 ART = lunes 20-abr ~02:00 UTC (ya “lunes” UTC)
    const appointment = new Date('2026-04-20T02:00:00.000Z');

    expect(appointment.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(appointment.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it('semana: lunes–domingo en Buenos Aires (no en UTC puro)', () => {
    const anchor = new Date('2026-04-16T15:00:00.000Z');
    const { start, end } = resolveCalendarRangeInTimeZone('week', anchor, AR);

    expect(start.toISOString()).toBe('2026-04-13T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-04-20T02:59:59.999Z');
  });

  it('día: inicio y fin de día civil en la zona', () => {
    const anchor = new Date('2026-04-19T15:00:00.000Z');
    const { start, end } = resolveCalendarRangeInTimeZone('day', anchor, AR);

    expect(start.toISOString()).toBe('2026-04-19T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-04-20T02:59:59.999Z');
  });

  it('timezone inválida usa fallback', () => {
    const anchor = new Date('2026-04-19T12:00:00.000Z');
    const { start } = resolveCalendarRangeInTimeZone(
      'day',
      anchor,
      'Not/AZone',
    );
    const ok = resolveCalendarRangeInTimeZone('day', anchor, FALLBACK_TIMEZONE);
    expect(start.getTime()).toBe(ok.start.getTime());
  });
});
