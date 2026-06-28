import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuditLoggerService {
  info(
    _event: string,
    _payload: Record<string, unknown>,
    _req?: Request,
  ): void {
    // No-op — logging deshabilitado por configuración.
    // Re-activar importando PinoLogger y descomentando el constructor.
  }

  warn(
    _event: string,
    _payload: Record<string, unknown>,
    _req?: Request,
  ): void {
    // No-op
  }
}
