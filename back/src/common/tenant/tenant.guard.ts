import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { TenantResolverService } from './tenant-resolver.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantResolver: TenantResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;

    if (!user?.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    const tenant = await this.tenantResolver.resolveFromRequest(req);

    switch (user.role) {
      case AccountRole.CENTER_ADMIN: {
        if (!tenant.organizationId || tenant.organizationId !== user.sub) {
          throw new UnauthorizedException('Token no pertenece a este tenant');
        }
        req.organizationId = tenant.organizationId;
        req.professionalId = null;
        req.tenantSlug = tenant.slug;
        req.role = AccountRole.CENTER_ADMIN;
        break;
      }

      case AccountRole.CENTER_MEMBER: {
        if (
          !tenant.organizationId ||
          !user.organizationId ||
          tenant.organizationId !== user.organizationId
        ) {
          throw new UnauthorizedException('Token no pertenece a este tenant');
        }
        if (tenant.professionalId !== user.sub) {
          throw new UnauthorizedException('Token no pertenece a este tenant');
        }
        req.professionalId = user.sub;
        req.organizationId = user.organizationId;
        req.tenantSlug = tenant.slug;
        req.role = AccountRole.CENTER_MEMBER;
        break;
      }

      case AccountRole.INDEPENDENT:
      default: {
        // Legacy / independent professional — same as before
        if (tenant.professionalId !== user.sub) {
          throw new UnauthorizedException('Token no pertenece a este tenant');
        }
        if (user.tenantSlug && user.tenantSlug !== tenant.slug) {
          throw new UnauthorizedException('Token no pertenece a este subdominio');
        }
        req.professionalId = tenant.professionalId;
        req.organizationId = null;
        req.tenantSlug = tenant.slug;
        req.role = AccountRole.INDEPENDENT;
        break;
      }
    }

    return true;
  }
}
