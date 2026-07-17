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
        paymentAlias: true,
        publicBookingEnabled: true,
        publicBookingSlug: true,
        depositAmount: true,
        depositWindowHours: true,
        maxActiveBookings: true,
        waPublicBookingPhone: true,
        intakeEnabled: true,
        depositEnabled: true,
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
        paymentAlias: true,
        publicBookingEnabled: true,
        publicBookingSlug: true,
        depositAmount: true,
        depositWindowHours: true,
        maxActiveBookings: true,
        waPublicBookingPhone: true,
        intakeEnabled: true,
        depositEnabled: true,
      },
    });
  }
}
