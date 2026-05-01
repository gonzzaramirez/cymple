import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class CenterAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;

    if (user?.role !== AccountRole.CENTER_ADMIN) {
      throw new ForbiddenException('Acceso exclusivo para administradores de centro');
    }

    return true;
  }
}
