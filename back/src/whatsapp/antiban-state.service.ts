import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  AntiBanGuard,
  AntiBanState,
  createAntiBanState,
  getWarmUpDailyLimit,
} from './antiban-guard';

/**
 * Tipo de entidad que posee una conexión WhatsApp.
 * - `professional`: profesional independiente
 * - `organization`: centro (org)
 */
export type WaEntityType = 'professional' | 'organization';

export interface WaEntityRef {
  type: WaEntityType;
  id: string;
}

/**
 * AntiBanStateService — Persiste y carga el estado anti-ban
 * de cada entidad (professional/org) en la base de datos.
 *
 * Reutiliza los campos waDailyMsgCount, waDailyCountDate,
 * waCircuitBreakerUntil y waConnectedSince que ya existen
 * en los modelos Professional y Organization.
 */
@Injectable()
export class AntiBanStateService {
  private readonly logger = new Logger(AntiBanStateService.name);

  /** Cache en memoria del estado anti-ban por entity key "prof:{id}" | "org:{id}" */
  private cache = new Map<string, AntiBanState>();
  private loadedFromDb = new Set<string>();

  /** FIFO mutex por entidad: serializa envíos salientes */
  private mutexChain = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  private entityKey(ref: WaEntityRef): string {
    return ref.type === 'professional' ? `prof:${ref.id}` : `org:${ref.id}`;
  }

  // ── Load / hydrate ─────────────────────────────────────────

  async loadState(ref: WaEntityRef): Promise<AntiBanState> {
    const key = this.entityKey(ref);

    if (!this.loadedFromDb.has(key)) {
      try {
        const state = await this.hydrateFromDb(ref);
        this.cache.set(key, state);
      } catch (err) {
        this.logger.error(`[AntiBan] Error loading state for ${key}: ${err}`);
        if (!this.cache.has(key)) {
          this.cache.set(key, createAntiBanState());
        }
      }
      this.loadedFromDb.add(key);
    }

    return this.cache.get(key)!;
  }

  private async hydrateFromDb(ref: WaEntityRef): Promise<AntiBanState> {
    const state = createAntiBanState();

    if (ref.type === 'professional') {
      const pro = await this.prisma.professional.findUnique({
        where: { id: ref.id },
        select: {
          waDailyMsgCount: true,
          waDailyCountDate: true,
          waCircuitBreakerUntil: true,
          waConnectedSince: true,
        },
      });
      if (pro) {
        state.dailyMessageCount = pro.waDailyMsgCount;
        state.dailyCountDate = pro.waDailyCountDate ?? '';
        state.circuitBreakerUntil = pro.waCircuitBreakerUntil
          ? pro.waCircuitBreakerUntil.getTime()
          : 0;
        state.effectiveDailyLimit = getWarmUpDailyLimit(pro.waConnectedSince);
      }
    } else {
      const org = await this.prisma.organization.findUnique({
        where: { id: ref.id },
        select: {
          waDailyMsgCount: true,
          waDailyCountDate: true,
          waCircuitBreakerUntil: true,
          waConnectedSince: true,
        },
      });
      if (org) {
        state.dailyMessageCount = org.waDailyMsgCount;
        state.dailyCountDate = org.waDailyCountDate ?? '';
        state.circuitBreakerUntil = org.waCircuitBreakerUntil
          ? org.waCircuitBreakerUntil.getTime()
          : 0;
        state.effectiveDailyLimit = getWarmUpDailyLimit(org.waConnectedSince);
      }
    }

    return state;
  }

  // ── Persist ────────────────────────────────────────────────

  async persistState(ref: WaEntityRef, state: AntiBanState): Promise<void> {
    const data = {
      waDailyMsgCount: state.dailyMessageCount,
      waDailyCountDate: state.dailyCountDate || null,
      waCircuitBreakerUntil:
        state.circuitBreakerUntil > 0
          ? new Date(state.circuitBreakerUntil)
          : null,
    };

    try {
      if (ref.type === 'professional') {
        await this.prisma.professional.update({
          where: { id: ref.id },
          data,
        });
      } else {
        await this.prisma.organization.update({
          where: { id: ref.id },
          data,
        });
      }
    } catch (err) {
      this.logger.error(
        `[AntiBan] Error persisting state for ${this.entityKey(ref)}: ${err}`,
      );
    }
  }

  /** Invalida la caché para que en el próximo loadState() se recargue desde DB */
  invalidateCache(ref: WaEntityRef): void {
    const key = this.entityKey(ref);
    this.loadedFromDb.delete(key);
    this.cache.delete(key);
  }

  // ── Mutex (FIFO) ───────────────────────────────────────────
  // Serializa los envíos salientes por entidad, tal como se hace en Gymple.

  /**
   * Ejecuta una función asegurada por mutex FIFO por entidad.
   * Garantiza que no haya dos envíos simultáneos para el mismo professional/org.
   */
  async runSerialized<T>(ref: WaEntityRef, fn: () => Promise<T>): Promise<T> {
    const key = this.entityKey(ref);
    const prev = this.mutexChain.get(key) ?? Promise.resolve();
    let releaseMutex!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseMutex = resolve;
    });
    this.mutexChain.set(key, current);

    try {
      await prev;
      return await fn();
    } finally {
      releaseMutex();
    }
  }
}
