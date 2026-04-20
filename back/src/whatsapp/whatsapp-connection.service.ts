import {
  BadRequestException,
  Injectable,
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

@Injectable()
export class WhatsappConnectionService {
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
    return `${base}/v1/webhooks/whatsapp`;
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

    let qr = extractQrBase64(createOrConnectResponse);
    if (!qr) {
      state = await this.evolution.getConnectionState(instanceName);
      if (state === 'open') {
        await this.prisma.professional.update({
          where: { id: professionalId },
          data: { waStatus: WaStatus.CONNECTED },
        });
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
    if (!this.evolution.isConfigured()) {
      return {
        uiStatus: 'disconnected',
        qr: null,
        dbStatus: WaStatus.DISCONNECTED,
        errorMessage: 'Evolution no configurada',
      };
    }

    const instanceName = await this.resolveInstanceName(professionalId);
    let state: string | undefined;
    try {
      state = await this.evolution.getConnectionState(instanceName);
    } catch (e) {
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waStatus: WaStatus.DISCONNECTED },
      });
      return {
        uiStatus: 'error',
        qr: null,
        dbStatus: WaStatus.DISCONNECTED,
        errorMessage:
          e instanceof Error ? e.message : 'No se pudo consultar Evolution',
      };
    }

    if (state === 'open') {
      await this.prisma.professional.update({
        where: { id: professionalId },
        data: { waStatus: WaStatus.CONNECTED },
      });
      return { uiStatus: 'ready', qr: null, dbStatus: WaStatus.CONNECTED };
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
        return { uiStatus: 'qr', qr, dbStatus: WaStatus.CONNECTING };
      }
      return {
        uiStatus: 'connecting',
        qr: null,
        dbStatus: WaStatus.CONNECTING,
      };
    }

    await this.prisma.professional.update({
      where: { id: professionalId },
      data: { waStatus: WaStatus.DISCONNECTED },
    });
    return {
      uiStatus: 'disconnected',
      qr: null,
      dbStatus: WaStatus.DISCONNECTED,
    };
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
}
