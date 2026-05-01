import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const TENANT_HEADER = 'x-tenant-slug';
const FORWARDED_HOST_HEADER = 'x-forwarded-host';

export interface ResolvedTenant {
  slug: string;
  professionalId: string;
}

@Injectable()
export class TenantResolverService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveFromRequest(req: any): Promise<ResolvedTenant> {
    const slug = this.extractSlugFromRequest(req);
    const professional = await this.prisma.professional.findFirst({
      where: {
        slug,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    if (!professional) {
      throw new UnauthorizedException('Tenant inválido o inactivo');
    }

    return { slug: professional.slug, professionalId: professional.id };
  }

  extractSlugFromRequest(req: any): string {
    const tenantHeader = this.readSingleHeader(req?.headers?.[TENANT_HEADER]);
    const host = this.resolveHostname(req);
    const baseDomain = this.configService.get<string>('BASE_DOMAIN')?.toLowerCase();
    const isProd = (this.configService.get<string>('NODE_ENV') ?? '').toLowerCase() === 'production';

    if (host && baseDomain) {
      if (host === baseDomain) {
        if (tenantHeader) return tenantHeader;
        throw new BadRequestException('Subdominio requerido');
      }

      if (!host.endsWith(`.${baseDomain}`)) {
        throw new BadRequestException('Host inválido para tenant');
      }

      const slug = host.slice(0, -(baseDomain.length + 1)).split('.').at(-1)?.trim();
      if (!slug) throw new BadRequestException('No se pudo resolver tenant');

      if (tenantHeader && tenantHeader !== slug) {
        throw new BadRequestException('Tenant mismatch');
      }
      return slug;
    }

    if (tenantHeader) return tenantHeader;
    if (isProd) throw new BadRequestException('No se pudo resolver tenant');
    return 'demo';
  }

  private resolveHostname(req: any): string | null {
    const forwardedHost = this.readSingleHeader(req?.headers?.[FORWARDED_HOST_HEADER]);
    const hostHeader = this.readSingleHeader(req?.headers?.host);
    const rawHost = (forwardedHost || hostHeader || '').trim().toLowerCase();
    if (!rawHost) return null;
    return rawHost.split(',')[0]?.trim().split(':')[0] ?? null;
  }

  private readSingleHeader(value: unknown): string | null {
    if (Array.isArray(value)) {
      return value[0]?.toString().trim().toLowerCase() || null;
    }
    if (typeof value === 'string') {
      return value.trim().toLowerCase() || null;
    }
    return null;
  }
}
