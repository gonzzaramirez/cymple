import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProfessionalModule } from './professional/professional.module';
import { AvailabilityModule } from './availability/availability.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { FinanceModule } from './finance/finance.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessageTemplatesModule } from './message-templates/message-templates.module';
import { TenantModule } from './common/tenant/tenant.module';
import { AuditModule } from './common/audit/audit.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('12h'),
        EVOLUTION_WEBHOOK_TOKEN: Joi.string().optional().allow(''),
        EVOLUTION_API_URL: Joi.string().optional().allow(''),
        EVOLUTION_API_KEY: Joi.string().optional().allow(''),
        APP_PUBLIC_URL: Joi.string().optional().allow(''),
        BASE_DOMAIN: Joi.string().optional().allow(''),
        TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
        PORT: Joi.number().default(3080),
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: process.env.NODE_ENV !== 'production',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty' },
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    TenantModule,
    AuditModule,
    AuthModule,
    ProfessionalModule,
    AvailabilityModule,
    PatientsModule,
    AppointmentsModule,
    FinanceModule,
    WebhooksModule,
    WhatsappModule,
    MessagesModule,
    DashboardModule,
    NotificationsModule,
    MessageTemplatesModule,
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
