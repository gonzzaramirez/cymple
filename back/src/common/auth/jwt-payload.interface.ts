import { AccountRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantSlug: string;
  role: AccountRole;
  organizationId?: string;
}
