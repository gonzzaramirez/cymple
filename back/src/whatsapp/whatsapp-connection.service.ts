import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WaStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  EvolutionApiError,
  EvolutionApiService,
  extractQrBase64,
} from './evolution-api.service';

export type WhatsappUiStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr'
  | 'ready'
  | 'error';

export function defaultWaInstanceName(professionalId: string): string {
  return `cymple-prof-${professionalId}`;
}

export function defaultOrgWaInstanceName(organizationId: string): string {
  return `cymple-org-${organizationId}`;
}

@Injectable()
export class WhatsappConnectionService {
  private readonly logger = new Logger(WhatsappConnectionService.name);

  private statusCache = new Map<string, { data: unknown; expires: number }>();
  private static readonly STATUS_CACHE_TTL_MS = 3_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionApiService,
    private readonly config: ConfigService,
  ) {}

  private webhookUrl(): string | undefined {
    const base = (this.config.get<string>('APP_PUBLIC_URL') ?? '').replace(
      /\/$/,
      '',
    );
    if (!base) return undefined;
    let url = `${base}/v1/webhooks/whatsapp`;
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    return url;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.statusCache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data as T;
    }
    if (entry) {
      this.statusCache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.statusCache.set(key, {
      data,
      expires: Date.now() + WhatsappConnectionService.STATUS_CACHE_TTL_MS,
    });
  }

  invalidateStatusCache(entityType: 'prof' | 'org', id: string): void {
    this.statusCache.delete(`${entityType}:${id}`);
  }

  /**
   * Registra waConnectedSince la primera vez que una entidad se conecta a WhatsApp.
   * Se usa para la warm-up schedule del anti-ban (números nuevos arrancan con límite bajo).
   */
  private async trackFirstConnection(
    entityType: 'professional' | 'organization',
    id: string,
  ): Promise<void> {
    try {
      if (entityType === 'professional') {
        await this.prisma.professional.updateMany({
          where: { id, waConnectedSince: null },
          data: { waConnectedSince: new Date() },
        });
      } else {
        await this.prisma.organization.updateMany({
          where: { id, waConnectedSince: null },
          data: { waConnectedSince: new Date() },
        });
      }
    } catch {
      // Non-critical — el anti-ban funciona igual con el límite full si no está seteado
    }
  }

  private async ensureWebhook(instanceName: string): Promise<void> {
    const webhook = this.webhookUrl();
    if (!webhook) {
      return;
    }
    await this.evolution.setWebhook(instanceName, webhook);
  }

  private ensureEvolution() {
    if (!this.evolution.isConfigured()) {
      throw new ServiceUnavailableException(
        'Evolution API no configurada. Definí EVOLUTION_API_URL y EVOLUTION_API_KEY.',
      );
    }
  }

  async resolveInstanceName(professionalId: string): Promise<string> {
    const pro = await this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: { waInstanceName: true },
    });
    const name = pro.waInstanceName ?? defaultWaInstanceName(professionalId);
    if (!pro.waInstanceName) {
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waInstanceName: name },
      });
    }
    return name;
  }

  async start(professionalId: string): Promise<{
    uiStatus: WhatsappUiStatus;
    qr: string | null;
    message: string;
  }> {
    this.ensureEvolution();
    const instanceName = await this.resolveInstanceName(professionalId);
    const webhook = this.webhookUrl();

    let state: string | undefined;
    try {
      state = await this.evolution.getConnectionState(instanceName);
    } catch (e) {
      // Si la instancia todavía no existe en Evolution, algunos deployments responden 404.
      // En ese caso el flujo correcto es crear la instancia y pedir el QR.
      if (e instanceof EvolutionApiError && e.status === 404) {
        state = undefined;
      } else {
        throw e;
      }
    }
    if (state === 'open') {
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waStatus: WaStatus.CONNECTED },
      });
      await this.trackFirstConnection('professional', professionalId);
      throw new BadRequestException('WhatsApp ya está conectado');
    }

    let createOrConnectResponse: Record<string, unknown> | undefined;
    try {
      createOrConnectResponse = await this.evolution.createInstance(
        instanceName,
        webhook,
      );
    } catch (e) {
      if (e instanceof EvolutionApiError) {
        const msg = JSON.stringify(e.body).toLowerCase();
        const conflict =
          e.status === 409 || msg.includes('already') || msg.includes('exist');
        if (conflict) {
          createOrConnectResponse = await this.evolution.connect(instanceName);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    await this.prisma.professional.update({
      where: { id: professionalId },
      data: { waStatus: WaStatus.CONNECTING },
    });

    await this.ensureWebhook(instanceName);

    let qr = extractQrBase64(createOrConnectResponse);
    if (!qr) {
      state = await this.evolution.getConnectionState(instanceName);
      if (state === 'open') {
        await this.prisma.professional.update({
          where: { id: professionalId },
          data: { waStatus: WaStatus.CONNECTED },
        });
        await this.trackFirstConnection('professional', professionalId);
        return {
          uiStatus: 'ready',
          qr: null,
          message: 'Sesión ya activa',
        };
      }
      try {
        const connectRes = await this.evolution.connect(instanceName);
        qr = extractQrBase64(connectRes) ?? qr;
      } catch {
        /* ignore */
      }
    }

    return {
      uiStatus: qr ? 'qr' : 'connecting',
      qr: qr ?? null,
      message: qr
        ? 'Escaneá el código QR con WhatsApp'
        : 'Iniciando conexión; consultá el estado en unos segundos',
    };
  }

  async getStatus(professionalId: string): Promise<{
    uiStatus: WhatsappUiStatus;
    qr: string | null;
    dbStatus: WaStatus;
    errorMessage?: string;
  }> {
    const cached = this.getCached<{
      uiStatus: WhatsappUiStatus;
      qr: string | null;
      dbStatus: WaStatus;
      errorMessage?: string;
    }>(`prof:${professionalId}`);
    if (cached) return cached;

    if (!this.evolution.isConfigured()) {
      const result = {
        uiStatus: 'disconnected' as const,
        qr: null as string | null,
        dbStatus: WaStatus.DISCONNECTED,
        errorMessage: 'Evolution no configurada',
      };
      this.setCache(`prof:${professionalId}`, result);
      return result;
    }

    const instanceName = await this.resolveInstanceName(professionalId);
    let state: string | undefined;
    try {
      state = await this.evolution.getConnectionState(instanceName);
    } catch (e) {
      // 404 = instancia aún no creada en Evolution → estado normal "disconnected"
      if (e instanceof EvolutionApiError && e.status === 404) {
        const result = {
          uiStatus: 'disconnected' as const,
          qr: null as string | null,
          dbStatus: WaStatus.DISCONNECTED,
        };
        this.setCache(`prof:${professionalId}`, result);
        return result;
      }
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waStatus: WaStatus.DISCONNECTED },
      });
      const result = {
        uiStatus: 'error' as const,
        qr: null as string | null,
        dbStatus: WaStatus.DISCONNECTED,
        errorMessage:
          e instanceof Error ? e.message : 'No se pudo consultar Evolution',
      };
      this.setCache(`prof:${professionalId}`, result);
      return result;
    }

    if (state === 'open') {
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waStatus: WaStatus.CONNECTED },
      });
      await this.trackFirstConnection('professional', professionalId);
      const result = {
        uiStatus: 'ready' as const,
        qr: null as string | null,
        dbStatus: WaStatus.CONNECTED,
      };
      this.setCache(`prof:${professionalId}`, result);
      return result;
    }

    if (state === 'connecting') {
      let qr: string | undefined;
      try {
        const connectRes = await this.evolution.connect(instanceName);
        qr = extractQrBase64(connectRes);
      } catch {
        /* ignore */
      }
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waStatus: WaStatus.CONNECTING },
      });
      if (qr) {
        const result = {
          uiStatus: 'qr' as const,
          qr: qr,
          dbStatus: WaStatus.CONNECTING,
        };
        this.setCache(`prof:${professionalId}`, result);
        return result;
      }
      const result = {
        uiStatus: 'connecting' as const,
        qr: null as string | null,
        dbStatus: WaStatus.CONNECTING,
      };
      this.setCache(`prof:${professionalId}`, result);
      return result;
    }

    await this.prisma.professional.update({
      where: { id: professionalId },
      data: { waStatus: WaStatus.DISCONNECTED },
    });
    const result = {
      uiStatus: 'disconnected' as const,
      qr: null as string | null,
      dbStatus: WaStatus.DISCONNECTED,
    };
    this.setCache(`prof:${professionalId}`, result);
    return result;
  }

  async logout(professionalId: string): Promise<void> {
    this.ensureEvolution();
    const instanceName = await this.resolveInstanceName(professionalId);
    try {
      await this.evolution.logout(instanceName);
    } catch {
      /* sesión ya cerrada en Evolution */
    }
    await this.prisma.professional.update({
      where: { id: professionalId },
      data: { waStatus: WaStatus.DISCONNECTED },
    });
  }

  // ── Org-level WhatsApp methods ──────────────────────────────────────────

  async resolveOrgInstanceName(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { waInstanceName: true },
    });
    const name = org.waInstanceName ?? defaultOrgWaInstanceName(organizationId);
    if (!org.waInstanceName) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { waInstanceName: name },
      });
    }
    return name;
  }

  async startOrg(organizationId: string) {
    this.ensureEvolution();
    const instanceName = await this.resolveOrgInstanceName(organizationId);
    const webhook = this.webhookUrl();

    let state: string | undefined;
    try {
      state = await this.evolution.getConnectionState(instanceName);
    } catch (e) {
      if (e instanceof EvolutionApiError && e.status === 404) {
        state = undefined;
      } else {
        throw e;
      }
    }

    if (state === 'open') {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { waStatus: WaStatus.CONNECTED },
      });
      await this.trackFirstConnection('organization', organizationId);
      throw new BadRequestException('WhatsApp ya está conectado');
    }

    let createOrConnectResponse: Record<string, unknown> | undefined;
    try {
      createOrConnectResponse = await this.evolution.createInstance(
        instanceName,
        webhook,
      );
    } catch (e) {
      if (e instanceof EvolutionApiError) {
        const msg = JSON.stringify(e.body).toLowerCase();
        const conflict =
          e.status === 409 || msg.includes('already') || msg.includes('exist');
        if (conflict) {
          createOrConnectResponse = await this.evolution.connect(instanceName);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { waStatus: WaStatus.CONNECTING },
    });

    await this.ensureWebhook(instanceName);

    let qr = extractQrBase64(createOrConnectResponse);
    if (!qr) {
      state = await this.evolution.getConnectionState(instanceName);
      if (state === 'open') {
        await this.prisma.organization.update({
          where: { id: organizationId },
          data: { waStatus: WaStatus.CONNECTED },
        });
        await this.trackFirstConnection('organization', organizationId);
        return {
          uiStatus: 'ready' as const,
          qr: null,
          message: 'Sesión ya activa',
        };
      }
      try {
        const connectRes = await this.evolution.connect(instanceName);
        qr = extractQrBase64(connectRes) ?? qr;
      } catch {
        /* ignore */
      }
    }

    return {
      uiStatus: (qr ? 'qr' : 'connecting') as WhatsappUiStatus,
      qr: qr ?? null,
      message: qr
        ? 'Escaneá el código QR con WhatsApp'
        : 'Iniciando conexión; consultá el estado en unos segundos',
    };
  }

  async getStatusOrg(organizationId: string) {
    const cached = this.getCached<{
      uiStatus: WhatsappUiStatus;
      qr: string | null;
      dbStatus: WaStatus;
      errorMessage?: string;
    }>(`org:${organizationId}`);
    if (cached) return cached;

    if (!this.evolution.isConfigured()) {
      const result = {
        uiStatus: 'disconnected' as const,
        qr: null as string | null,
        dbStatus: WaStatus.DISCONNECTED,
      };
      this.setCache(`org:${organizationId}`, result);
      return result;
    }
    const instanceName = await this.resolveOrgInstanceName(organizationId);
    let state: string | undefined;
    try {
      state = await this.evolution.getConnectionState(instanceName);
    } catch (e) {
      // 404 = instancia aún no creada en Evolution → estado normal "disconnected"
      if (e instanceof EvolutionApiError && e.status === 404) {
        const result = {
          uiStatus: 'disconnected' as const,
          qr: null as string | null,
          dbStatus: WaStatus.DISCONNECTED,
        };
        this.setCache(`org:${organizationId}`, result);
        return result;
      }
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { waStatus: WaStatus.DISCONNECTED },
      });
      const result = {
        uiStatus: 'error' as const,
        qr: null as string | null,
        dbStatus: WaStatus.DISCONNECTED,
        errorMessage:
          e instanceof Error ? e.message : 'No se pudo consultar Evolution',
      };
      this.setCache(`org:${organizationId}`, result);
      return result;
    }

    if (state === 'open') {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { waStatus: WaStatus.CONNECTED },
      });
      await this.trackFirstConnection('organization', organizationId);
      const result = {
        uiStatus: 'ready' as const,
        qr: null as string | null,
        dbStatus: WaStatus.CONNECTED,
      };
      this.setCache(`org:${organizationId}`, result);
      return result;
    }

    if (state === 'connecting') {
      let qr: string | undefined;
      try {
        const connectRes = await this.evolution.connect(instanceName);
        qr = extractQrBase64(connectRes);
      } catch {
        /* ignore */
      }
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { waStatus: WaStatus.CONNECTING },
      });
      if (qr) {
        const result = {
          uiStatus: 'qr' as const,
          qr: qr,
          dbStatus: WaStatus.CONNECTING,
        };
        this.setCache(`org:${organizationId}`, result);
        return result;
      }
      const result = {
        uiStatus: 'connecting' as const,
        qr: null as string | null,
        dbStatus: WaStatus.CONNECTING,
      };
      this.setCache(`org:${organizationId}`, result);
      return result;
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { waStatus: WaStatus.DISCONNECTED },
    });
    const result = {
      uiStatus: 'disconnected' as const,
      qr: null as string | null,
      dbStatus: WaStatus.DISCONNECTED,
    };
    this.setCache(`org:${organizationId}`, result);
    return result;
  }

  async logoutOrg(organizationId: string): Promise<void> {
    this.ensureEvolution();
    const instanceName = await this.resolveOrgInstanceName(organizationId);
    try {
      await this.evolution.logout(instanceName);
    } catch {
      /* sesión ya cerrada */
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { waStatus: WaStatus.DISCONNECTED },
    });
  }
}
