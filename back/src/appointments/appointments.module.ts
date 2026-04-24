import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ReminderSweeper } from './reminder-sweeper.service';

@Module({
  imports: [WhatsappModule, NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, ReminderSweeper],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
