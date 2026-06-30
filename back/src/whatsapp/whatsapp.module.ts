import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { EvolutionApiService } from './evolution-api.service';
import { WhatsappConnectionService } from './whatsapp-connection.service';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { AntiBanStateService } from './antiban-state.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [PrismaModule, NotificationsModule, MessageTemplatesModule],
  controllers: [WhatsappController],
  providers: [
    EvolutionApiService,
    WhatsappConnectionService,
    WhatsappMessagingService,
    AntiBanStateService,
  ],
  exports: [
    EvolutionApiService,
    WhatsappConnectionService,
    WhatsappMessagingService,
    AntiBanStateService,
  ],
})
export class WhatsappModule {}
