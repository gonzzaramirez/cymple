import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class AuditLoggerService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AuditLoggerService.name);
  }

  info(event: string, payload: Record<string, unknown>, req?: Request): void {
    this.logger.info(
      {
        event,
        ...payload,
        ...(req ? this.requestMeta(req) : {}),
      },
      'audit',
    );
  }

  warn(event: string, payload: Record<string, unknown>, req?: Request): void {
    this.logger.warn(
      {
        event,
        ...payload,
        ...(req ? this.requestMeta(req) : {}),
      },
      'audit',
    );
  }

  private requestMeta(req: Request): Record<string, unknown> {
    return {
      ip:
        req.headers['cf-connecting-ip'] ||
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.ip,
      host: req.headers['x-forwarded-host'] || req.headers.host,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.originalUrl,
      tenantSlug: (req as any).tenantSlug || req.headers['x-tenant-slug'],
      requestId: (req as any).id,
    };
  }
}
