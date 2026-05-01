import { AccountRole } from '@prisma/client';

export type AccessContext =
  | { role: 'INDEPENDENT'; professionalId: string; organizationId: null }
  | { role: 'CENTER_ADMIN'; organizationId: string; professionalId: null }
  | { role: 'CENTER_MEMBER'; professionalId: string; organizationId: string };

export function buildAccessContext(req: any): AccessContext {
  const role: string = req.role ?? AccountRole.INDEPENDENT;

  if (role === AccountRole.CENTER_ADMIN) {
    return {
      role: 'CENTER_ADMIN',
      organizationId: req.organizationId as string,
      professionalId: null,
    };
  }

  if (role === AccountRole.CENTER_MEMBER) {
    return {
      role: 'CENTER_MEMBER',
      professionalId: req.professionalId as string,
      organizationId: req.organizationId as string,
    };
  }

  return {
    role: 'INDEPENDENT',
    professionalId: req.professionalId as string,
    organizationId: null,
  };
}
