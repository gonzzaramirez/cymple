import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const baseDomain = (config.get<string>('BASE_DOMAIN') ?? '').toLowerCase();
  const trustProxy = config.get<boolean>('TRUST_PROXY') ?? false;

  if (trustProxy) {
    (app as any).set('trust proxy', 1);
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || !baseDomain) {
        callback(null, true);
        return;
      }

      try {
        const url = new URL(origin);
        const host = url.hostname.toLowerCase();
        if (host === baseDomain || host.endsWith(`.${baseDomain}`)) {
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
