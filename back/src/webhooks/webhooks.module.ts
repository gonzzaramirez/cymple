import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PublicBookingModule } from '../public-booking/public-booking.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    forwardRef(() => PublicBookingModule),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
