import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantResolver: TenantResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as
      | { sub?: string; tenantSlug?: string }
      | undefined;

    if (!user?.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    const tenant = await this.tenantResolver.resolveFromRequest(req);
    if (tenant.professionalId !== user.sub) {
      throw new UnauthorizedException('Token no pertenece a este tenant');
    }

    if (user.tenantSlug && user.tenantSlug !== tenant.slug) {
      throw new UnauthorizedException('Token no pertenece a este subdominio');
    }

    req.professionalId = tenant.professionalId;
    req.tenantSlug = tenant.slug;
    return true;
  }
}
