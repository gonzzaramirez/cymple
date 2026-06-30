import { DateTime } from 'luxon';

// ─── Configuration ───────────────────────────────────────────

export const ANTIBAN_CONFIG = {
  /** Cooldown between messages (Gaussian, μ=11500ms). */
  cooldownMeanMs: 11_500,
  cooldownStdMs: 2_000,
  cooldownMinMs: 6_000,
  cooldownMaxMs: 30_000,

  /** Typing simulation: ~30ms/char. Max 2000ms para evitar timeouts en Evolution API. */
  typingMsPerChar: 30,
  typingStdFraction: 0.3,
  typingMinMs: 800,
  typingMaxMs: 2_000,

  /** Rate limits — granular buckets. */
  dailyHardLimit: 80,
  dailySoftLimit: 50,
  softLimitDelayMultiplier: 2,
  maxPerMinute: 6,
  maxPerHour: 60,

  /** Operating hours (Argentina time). */
  operatingHoursStart: 8,
  operatingHoursEnd: 21,

  /** Circadian multipliers indexed by hour (within operating hours). */
  circadianTable: [
    { startHour: 8, multiplier: 0.5 }, // slow start
    { startHour: 9, multiplier: 0.8 }, // ramping up
    { startHour: 12, multiplier: 0.6 }, // siesta
    { startHour: 14, multiplier: 1.0 }, // full activity
    { startHour: 19, multiplier: 0.7 }, // wind down
  ] as Array<{ startHour: number; multiplier: number }>,

  timezone: 'America/Argentina/Buenos_Aires',

  /** Circuit breaker. */
  banSignalWindowMs: 10 * 60 * 1_000,
  banSignalThreshold: 2,
  circuitBreakerPauseMs: 2 * 60 * 60 * 1_000,
} as const;

// ─── Warm-up schedule ────────────────────────────────────────

const WARM_UP_SCHEDULE: Array<{ daysMax: number; limit: number }> = [
  { daysMax: 3, limit: 20 },
  { daysMax: 7, limit: 50 },
  { daysMax: 14, limit: 80 },
];

export function getWarmUpDailyLimit(connectedSince: Date | null): number {
  if (!connectedSince) return ANTIBAN_CONFIG.dailyHardLimit;
  const daysSince = Math.floor(
    (Date.now() - connectedSince.getTime()) / (24 * 60 * 60 * 1_000),
  );
  for (const tier of WARM_UP_SCHEDULE) {
    if (daysSince <= tier.daysMax) return tier.limit;
  }
  return ANTIBAN_CONFIG.dailyHardLimit;
}

// ─── Ban signal patterns ─────────────────────────────────────

const BAN_SIGNAL_PATTERNS = [
  'Could not send message',
  'not-authorized',
  'rate-overlimit',
  'Connection closed',
  'UNPAIRED',
  '428',
  'Instance not found',
  'not open',
  'Session not found',
  'disconnected',
  'REQUIRE_SCAN',
  'device_removed',
];

// ─── Per-session anti-ban state ──────────────────────────────

export interface AntiBanState {
  lastMessageSentAt: number;
  dailyMessageCount: number;
  dailyCountDate: string;
  banSignalTimestamps: number[];
  circuitBreakerUntil: number;
  effectiveDailyLimit: number;
  /** Minute bucket (in-memory only — resets on restart). */
  minuteMessageCount: number;
  minuteBucketStart: number;
  /** Hour bucket (in-memory only). */
  hourMessageCount: number;
  hourBucketStart: number;
}

export function createAntiBanState(): AntiBanState {
  const now = Date.now();
  return {
    lastMessageSentAt: 0,
    dailyMessageCount: 0,
    dailyCountDate: '',
    banSignalTimestamps: [],
    circuitBreakerUntil: 0,
    effectiveDailyLimit: ANTIBAN_CONFIG.dailyHardLimit,
    minuteMessageCount: 0,
    minuteBucketStart: now,
    hourMessageCount: 0,
    hourBucketStart: now,
  };
}

// ─── Gaussian helpers ────────────────────────────────────────

/**
 * Box-Muller transform → normally distributed value.
 * ~99.7% of values are within mean ± 3*stdDev.
 */
export function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Circadian rhythm ────────────────────────────────────────

/**
 * Returns the per-hour capacity multiplier for the given hour (0-23).
 * Outside operating hours returns 0.
 */
export function getCircadianMultiplier(hour: number): number {
  const {
    operatingHoursStart: start,
    operatingHoursEnd: end,
    circadianTable,
  } = ANTIBAN_CONFIG;
  if (hour < start || hour >= end) return 0;

  // Find the last-in-effect row (rows are sorted by startHour ascending)
  let multiplier = 1;
  for (const row of circadianTable) {
    if (hour >= row.startHour) multiplier = row.multiplier;
  }
  return multiplier;
}

// ─── Operating hours check ───────────────────────────────────

export function isWithinOperatingHours(tz: string): boolean {
  const hour = DateTime.now().setZone(tz).hour;
  return (
    ANTIBAN_CONFIG.operatingHoursStart <= hour &&
    hour < ANTIBAN_CONFIG.operatingHoursEnd
  );
}

// ─── Content variation ───────────────────────────────────────

const ZWSP = '\u200B';

/**
 * Injects subtle invisible zero-width spaces into the message text
 * so identical templates produce different byte-level fingerprints.
 *
 * Uses a seeded deterministic RNG so the same text + recipient
 * always produces the same variation (no surprise on retry).
 * The ZWSP is invisible to users and does NOT change the rendered text.
 */
export function varyMessageContent(
  text: string,
  recipientSeed: string,
): string {
  if (!text || text.length < 3) return text;

  // Seeded LCG — deterministic for same inputs
  const seed =
    text.length * 7 + recipientSeed.length * 13 + recipientSeed.charCodeAt(0) ||
    42;
  let rngState = seed & 0x7fffffff;
  const nextF = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  // Split preserving whitespace runs
  const tokens = text.split(/(\s+)/);
  return tokens
    .map((token) => {
      if (/^\s+$/.test(token) || token.length < 2) return token;
      // ~15% of tokens get a ZWSP injected at a random character boundary
      if (nextF() < 0.15) {
        const pos = Math.floor(nextF() * (token.length - 1)) + 1;
        return token.slice(0, pos) + ZWSP + token.slice(pos);
      }
      return token;
    })
    .join('');
}

// ─── Typing delay ────────────────────────────────────────────

/**
 * Calculates a human-like typing delay proportional to message length,
 * with Gaussian jitter. This is the number of ms the Evolution API
 * should simulate "composing" before sending.
 */
export function calculateTypingDelay(text: string): number {
  const { typingMsPerChar, typingStdFraction, typingMinMs, typingMaxMs } =
    ANTIBAN_CONFIG;
  const base = text.length * typingMsPerChar;
  const jitter = gaussianRandom(0, base * typingStdFraction);
  return clamp(Math.round(base + jitter), typingMinMs, typingMaxMs);
}

// ─── Guard class ─────────────────────────────────────────────

export class AntiBanGuard {
  /**
   * Throws if the session should NOT send a message right now.
   * Checks: circuit breaker, operating hours, daily limit, per-hour limit, per-minute limit.
   */
  assertCanSend(state: AntiBanState, timezone?: string): void {
    if (Date.now() < state.circuitBreakerUntil) {
      throw new Error('[Anti-Ban] Circuit breaker activo.');
    }

    const tz = timezone ?? ANTIBAN_CONFIG.timezone;

    // ── Operating hours ──────────────────────────────────────
    if (!isWithinOperatingHours(tz)) {
      throw new Error('[Anti-Ban] Fuera del horario de operación (8-21 ART).');
    }

    // ── Daily reset ──────────────────────────────────────────
    const todayKey = DateTime.now().setZone(tz).toFormat('yyyy-MM-dd');
    if (state.dailyCountDate !== todayKey) {
      state.dailyMessageCount = 0;
      state.dailyCountDate = todayKey;
    }

    const dailyLimit =
      state.effectiveDailyLimit > 0
        ? state.effectiveDailyLimit
        : ANTIBAN_CONFIG.dailyHardLimit;

    if (state.dailyMessageCount >= dailyLimit) {
      throw new Error(`[Anti-Ban] Límite diario alcanzado (${dailyLimit}).`);
    }

    // ── Minute bucket ────────────────────────────────────────
    const now = Date.now();
    const minuteFloor = Math.floor(now / 60_000);
    if (minuteFloor !== state.minuteBucketStart) {
      state.minuteMessageCount = 0;
      state.minuteBucketStart = minuteFloor;
    }
    if (state.minuteMessageCount >= ANTIBAN_CONFIG.maxPerMinute) {
      throw new Error(
        `[Anti-Ban] Límite por minuto alcanzado (${ANTIBAN_CONFIG.maxPerMinute}).`,
      );
    }

    // ── Hour bucket ──────────────────────────────────────────
    const hourFloor = Math.floor(now / 3_600_000);
    if (hourFloor !== state.hourBucketStart) {
      state.hourMessageCount = 0;
      state.hourBucketStart = hourFloor;
    }

    const circadianMul = getCircadianMultiplier(
      DateTime.now().setZone(tz).hour,
    );
    const hourLimit = Math.max(
      1,
      Math.round(ANTIBAN_CONFIG.maxPerHour * circadianMul),
    );
    if (state.hourMessageCount >= hourLimit) {
      throw new Error(`[Anti-Ban] Límite por hora alcanzado (${hourLimit}).`);
    }
  }

  /**
   * Returns Gaussian-jittered cooldown (ms) the caller should wait before
   * sending. Values cluster around 11.5s, clamped to [6s, 30s].
   * At soft limit, delays are doubled.
   */
  getCooldownMs(state: AntiBanState): number {
    const elapsed = Date.now() - state.lastMessageSentAt;

    const dailyLimit =
      state.effectiveDailyLimit > 0
        ? state.effectiveDailyLimit
        : ANTIBAN_CONFIG.dailyHardLimit;

    const softLimit = Math.min(
      ANTIBAN_CONFIG.dailySoftLimit,
      Math.floor(
        dailyLimit *
          (ANTIBAN_CONFIG.dailySoftLimit / ANTIBAN_CONFIG.dailyHardLimit),
      ),
    );

    const { cooldownMeanMs, cooldownStdMs, cooldownMinMs, cooldownMaxMs } =
      ANTIBAN_CONFIG;
    let raw = gaussianRandom(cooldownMeanMs, cooldownStdMs);
    raw = clamp(raw, cooldownMinMs, cooldownMaxMs);

    const multiplier =
      state.dailyMessageCount >= softLimit
        ? ANTIBAN_CONFIG.softLimitDelayMultiplier
        : 1;

    return Math.max(0, raw * multiplier - elapsed);
  }

  /** Call after a successful send. */
  recordSuccess(state: AntiBanState): void {
    state.lastMessageSentAt = Date.now();
    state.dailyMessageCount++;
    state.minuteMessageCount++;
    state.hourMessageCount++;
  }

  /** Call when a send error looks like a ban signal. */
  recordBanSignal(state: AntiBanState): void {
    const now = Date.now();
    state.banSignalTimestamps.push(now);
    state.banSignalTimestamps = state.banSignalTimestamps.filter(
      (ts) => now - ts < ANTIBAN_CONFIG.banSignalWindowMs,
    );
    if (state.banSignalTimestamps.length >= ANTIBAN_CONFIG.banSignalThreshold) {
      state.circuitBreakerUntil = now + ANTIBAN_CONFIG.circuitBreakerPauseMs;
      state.banSignalTimestamps = [];
    }
  }

  /** Check if the error message matches known ban-signal patterns. */
  isBanSignalError(msg: string): boolean {
    return BAN_SIGNAL_PATTERNS.some((p) => msg.includes(p));
  }
}
