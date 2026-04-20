import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EvolutionApiService } from './evolution-api.service';
import { WhatsappConnectionService } from './whatsapp-connection.service';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsappController],
  providers: [
    EvolutionApiService,
    WhatsappConnectionService,
    WhatsappMessagingService,
  ],
  exports: [
    EvolutionApiService,
    WhatsappConnectionService,
    WhatsappMessagingService,
  ],
})
export class WhatsappModule {}
