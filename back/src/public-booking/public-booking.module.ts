import { forwardRef, Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  PublicBookingController,
  BookingDashboardController,
} from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { BookingCronService } from './booking-cron.service';

@Module({
  imports: [
    forwardRef(() => AvailabilityModule),
    forwardRef(() => WhatsappModule),
    NotificationsModule,
    MessageTemplatesModule,
  ],
  controllers: [PublicBookingController, BookingDashboardController],
  providers: [PublicBookingService, BookingCronService],
  exports: [PublicBookingService],
})
export class PublicBookingModule {}
