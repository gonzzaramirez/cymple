import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateProfessionalSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class ProfessionalService {
  constructor(private readonly prisma: PrismaService) {}

  getSettings(professionalId: string) {
    return this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: {
        id: true,
        fullName: true,
        consultationMinutes: true,
        bufferMinutes: true,
        minRescheduleHours: true,
        standardFee: true,
        reminderHours: true,
        timezone: true,
        dailyDigestEnabled: true,
        dailyDigestTime: true,
        autoConfirmHours: true,
        paymentAlias: true,
        publicBookingEnabled: true,
        publicBookingSlug: true,
        depositAmount: true,
        depositWindowHours: true,
        bookingAutoCancel: true,
        bookingAutoCancelHours: true,
        maxActiveBookings: true,
        waPublicBookingPhone: true,
      },
    });
  }

  updateSettings(professionalId: string, dto: UpdateProfessionalSettingsDto) {
    return this.prisma.professional.update({
      where: { id: professionalId },
      data: dto,
      select: {
        id: true,
        consultationMinutes: true,
        bufferMinutes: true,
        minRescheduleHours: true,
        standardFee: true,
        reminderHours: true,
        timezone: true,
        dailyDigestEnabled: true,
        dailyDigestTime: true,
        autoConfirmHours: true,
        paymentAlias: true,
        publicBookingEnabled: true,
        publicBookingSlug: true,
        depositAmount: true,
        depositWindowHours: true,
        bookingAutoCancel: true,
        bookingAutoCancelHours: true,
        maxActiveBookings: true,
        waPublicBookingPhone: true,
      },
    });
  }
}
