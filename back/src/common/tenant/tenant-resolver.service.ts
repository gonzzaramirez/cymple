import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TENANT_HEADER = 'x-tenant-slug';
const TENANT_HOST_HEADER = 'x-tenant-host';
const FORWARDED_HOST_HEADER = 'x-forwarded-host';
const ORIGIN_HEADER = 'origin';
const TENANT_SLUG_REGEX = /^[a-z0-9-]+$/;
const RESERVED_INFRA_SUBDOMAINS = new Set(['api', 'www', 'apitest']);

export interface ResolvedTenant {
  slug: string;
  /** Slug de la organizaciÃ³n cuando el tenant es un profesional miembro (para validar JWT). */
  organizationSlug?: string | null;
  professionalId: string | null;
  organizationId: string | null;
  role: AccountRole;
}

@Injectable()
export class TenantResolverService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveFromRequest(req: any): Promise<ResolvedTenant> {
    const slug = this.extractSlugFromRequest(req);

    // Check if slug belongs to an Organization
    const org = await this.prisma.organization.findFirst({
      where: { slug, isActive: true },
      select: { id: true, slug: true },
    });

    if (org) {
      return {
        slug: org.slug,
        organizationSlug: org.slug,
        professionalId: null,
        organizationId: org.id,
        role: AccountRole.CENTER_ADMIN,
      };
    }

    // Check Professional
    const professional = await this.prisma.professional.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        organizationId: true,
        organization: { select: { slug: true } },
      },
    });

    if (!professional) {
      throw new UnauthorizedException('Tenant invÃ¡lido o inactivo');
    }

    if (professional.organizationId) {
      return {
        slug: professional.slug,
        organizationSlug: professional.organization?.slug ?? null,
        professionalId: professional.id,
        organizationId: professional.organizationId,
        role: AccountRole.CENTER_MEMBER,
      };
    }

    return {
      slug: professional.slug,
      organizationSlug: null,
      professionalId: professional.id,
      organizationId: null,
      role: AccountRole.INDEPENDENT,
    };
  }

  /**
   * Detecta si Cloudflare Tunnel (u otro reverse proxy) sobrescribiÃ³
   * X-Forwarded-Host. Cuando forwardedHost === host header, el valor
   * original del frontend proxy se perdiÃ³.
   */
  private isForwardedHostOverwritten(req: any): boolean {
    const forwardedHost = this.readSingleHeader(
      req?.headers?.[FORWARDED_HOST_HEADER],
    );
    const hostHeader = this.readSingleHeader(req?.headers?.host);
    return !!(forwardedHost && hostHeader && forwardedHost === hostHeader);
  }

  /**
   * Slug solo desde Host / Origin + BASE_DOMAIN (sin confiar en X-Tenant-Slug
   * salvo fallback controlado cuando el proxy ya detectÃ³ overwrite).
   */
  extractSlugFromHostContextOnly(req: any): string {
    return this.resolveSlugFromHostContext(req);
  }

  extractSlugFromRequest(req: any): string {
    return this.resolveSlugFromHostContext(req);
  }

  private resolveSlugFromHostContext(req: any): string {
    const baseDomain = this.configService
      .get<string>('BASE_DOMAIN')
      ?.toLowerCase();
    const isProd =
      (this.configService.get<string>('NODE_ENV') ?? '').toLowerCase() ===
      'production';

    const tenantHost = this.resolveTenantHostname(req);
    const host = this.resolveHostname(req);
    const originHost = this.resolveOriginHostname(req);

    const tenantHostSlug = this.extractSlugFromHostname(tenantHost, baseDomain);
    const hostSlug = this.extractSlugFromHostname(host, baseDomain);
    const originSlug = this.extractSlugFromHostname(originHost, baseDomain);

    if (tenantHostSlug && originSlug && tenantHostSlug !== originSlug) {
      throw new BadRequestException('Tenant mismatch');
    }

    if (hostSlug && originSlug && hostSlug !== originSlug) {
      throw new BadRequestException('Tenant mismatch');
    }

    if (tenantHostSlug) return tenantHostSlug;

    // Fallback: usar X-Tenant-Slug directamente (seteado por el frontend proxy).
    // Cubre casos donde Cloudflare no preserva X-Forwarded-Host ni X-Tenant-Host.
    const tenantSlugHeader = this.validateSlug(
      this.readSingleHeader(req?.headers?.[TENANT_HEADER]),
      'Tenant invÃ¡lido',
    );
    if (tenantSlugHeader) return tenantSlugHeader;

    if (hostSlug) return hostSlug;
    if (originSlug) return originSlug;

    if (baseDomain && host === baseDomain) {
      throw new BadRequestException('Subdominio requerido');
    }

    if (
      baseDomain &&
      host &&
      !host.endsWith(`.${baseDomain}`) &&
      host !== 'localhost'
    ) {
      throw new BadRequestException('Host invÃ¡lido para tenant');
    }

    if (isProd) throw new BadRequestException('No se pudo resolver tenant');
    return 'demo';
  }

  private extractSlugFromHostname(
    hostname: string | null,
    baseDomain: string | undefined,
  ): string | null {
    if (!hostname || !baseDomain) return null;
    if (hostname === baseDomain) return null;
    if (!hostname.endsWith(`.${baseDomain}`)) return null;

    const slug = hostname
      .slice(0, -(baseDomain.length + 1))
      .split('.')
      .at(-1)
      ?.trim()
      .toLowerCase();
    const validatedSlug = this.validateSlug(
      slug ?? null,
      'No se pudo resolver tenant',
    );
    if (validatedSlug && RESERVED_INFRA_SUBDOMAINS.has(validatedSlug)) {
      return null;
    }
    return validatedSlug;
  }

  private resolveHostname(req: any): string | null {
    const forwardedHost = this.readSingleHeader(
      req?.headers?.[FORWARDED_HOST_HEADER],
    );
    const hostHeader = this.readSingleHeader(req?.headers?.host);
    const rawHost = (forwardedHost || hostHeader || '').trim().toLowerCase();
    if (!rawHost) return null;
    return rawHost.split(',')[0]?.trim().split(':')[0] ?? null;
  }

  private resolveTenantHostname(req: any): string | null {
    const tenantHost = this.readSingleHeader(
      req?.headers?.[TENANT_HOST_HEADER],
    );
    if (!tenantHost) return null;
    return tenantHost.split(',')[0]?.trim().split(':')[0] ?? null;
  }

  private resolveOriginHostname(req: any): string | null {
    const origin = this.readSingleHeader(req?.headers?.[ORIGIN_HEADER]);
    if (!origin) return null;
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return null;
    }
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

  private validateSlug(value: string | null, message: string): string | null {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (!TENANT_SLUG_REGEX.test(normalized)) {
      throw new BadRequestException(message);
    }
    return normalized;
  }
}
