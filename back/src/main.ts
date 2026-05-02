import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const baseDomain = (config.get<string>('BASE_DOMAIN') ?? '').toLowerCase();
  const trustProxy = config.get<boolean>('TRUST_PROXY') ?? false;
  const isProduction =
    (config.get<string>('NODE_ENV') ?? '').toLowerCase() === 'production';
  const allowedBaseDomainRegex = baseDomain
    ? new RegExp(
        `^https:\\/\\/(?:[a-z0-9-]+\\.)*${escapeRegExp(baseDomain)}$`,
        'i',
      )
    : null;
  const localhostRegex = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

  if (trustProxy) {
    (app as any).set('trust proxy', true);
    app.use((req: any, _res: any, next: () => void) => {
      const cfConnectingIp = req?.headers?.['cf-connecting-ip'];
      const xForwardedFor = req?.headers?.['x-forwarded-for'];

      if (
        typeof cfConnectingIp === 'string' &&
        cfConnectingIp.trim() &&
        (!xForwardedFor ||
          (typeof xForwardedFor === 'string' && !xForwardedFor.trim()))
      ) {
        req.headers['x-forwarded-for'] = cfConnectingIp.trim();
      }
      next();
    });
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedBaseDomainRegex?.test(origin)) {
        callback(null, true);
        return;
      }

      if (!isProduction && localhostRegex.test(origin)) {
        callback(null, true);
        return;
      }

      if (!allowedBaseDomainRegex && !isProduction) {
        try {
          const originUrl = new URL(origin);
          if (
            originUrl.hostname.toLowerCase() === 'localhost' ||
            originUrl.hostname === '127.0.0.1'
          ) {
            callback(null, true);
            return;
          }
        } catch {
          // invalid origin
        }
      }

      if (!allowedBaseDomainRegex && isProduction) {
        callback(new Error('BASE_DOMAIN no configurado en producción'));
        return;
      }

      try {
        const originUrl = new URL(origin);
        if (
          originUrl.protocol === 'https:' &&
          allowedBaseDomainRegex?.test(origin)
        ) {
          callback(null, true);
          return;
        }
      } catch {
        // invalid origin
      }
      callback(new Error('CORS no permitido'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
  });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3080);
}
bootstrap();
