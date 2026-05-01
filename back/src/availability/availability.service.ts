import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Weekday } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpsertWeeklyAvailabilityDto } from './dto/upsert-weekly-availability.dto';
import { UpsertSpecificDateAvailabilityDto } from './dto/upsert-specific-date-availability.dto';
import { ARG_TZ, addMinutes, setTimeOnDate } from '../common/utils/date.utils';
import { AccessContext } from '../common/tenant/access-context';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveProfessionalIdForContext(
    ctx: AccessContext,
    queryProfessionalId?: string,
  ): Promise<string> {
    if (ctx.role !== 'CENTER_ADMIN') {
      return ctx.professionalId!;
    }

    if (!queryProfessionalId) {
      throw new BadRequestException(
        'Parámetro professionalId requerido para administrador de centro',
      );
    }

    const professional = await this.prisma.professional.findFirst({
      where: {
        id: queryProfessionalId,
        organizationId: ctx.organizationId,
      },
      select: { id: true },
    });

    if (!professional) {
      throw new NotFoundException('Profesional no encontrado en el centro');
    }

    return professional.id;
  }

  async upsertWeekly(professionalId: string, dto: UpsertWeeklyAvailabilityDto) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        if (item.ranges.some((range) => range.startTime >= range.endTime)) {
          throw new BadRequestException(
            'Rango inválido en disponibilidad semanal',
          );
        }

        const availability = await tx.weeklyAvailability.upsert({
          where: {
            professionalId_weekday: {
              professionalId,
              weekday: item.weekday,
            },
          },
          create: {
            professionalId,
            weekday: item.weekday,
            isEnabled: item.isEnabled ?? true,
          },
          update: {
            isEnabled: item.isEnabled ?? true,
          },
        });

        await tx.availabilityRange.deleteMany({
          where: { weeklyAvailabilityId: availability.id },
        });

        if (item.ranges.length > 0) {
          await tx.availabilityRange.createMany({
            data: item.ranges.map((range) => ({
              weeklyAvailabilityId: availability.id,
              startTime: range.startTime,
              endTime: range.endTime,
              capacity: range.capacity ?? null,
            })),
          });
        }
      }
    });

    return this.getWeekly(professionalId);
  }

  getWeekly(professionalId: string) {
    return this.prisma.weeklyAvailability.findMany({
      where: { professionalId },
      include: {
        ranges: {
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { weekday: 'asc' },
    });
  }

  async upsertSpecificDates(
    professionalId: string,
    dto: UpsertSpecificDateAvailabilityDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        if (item.ranges.some((range) => range.startTime >= range.endTime)) {
          throw new BadRequestException(
            'Rango inválido en disponibilidad por fecha',
          );
        }

        const date = new Date(item.date);
        const availability = await tx.specificDateAvailability.upsert({
          where: { professionalId_date: { professionalId, date } },
          create: {
            professionalId,
            date,
            isEnabled: item.isEnabled ?? true,
          },
          update: {
            isEnabled: item.isEnabled ?? true,
          },
        });

        await tx.availabilityRange.deleteMany({
          where: { specificDateAvailabilityId: availability.id },
        });

        if (item.ranges.length > 0) {
          await tx.availabilityRange.createMany({
            data: item.ranges.map((range) => ({
              specificDateAvailabilityId: availability.id,
              startTime: range.startTime,
              endTime: range.endTime,
              capacity: range.capacity ?? null,
            })),
          });
        }

        await tx.availabilitySlotCapacity.deleteMany({
          where: { specificDateAvailabilityId: availability.id },
        });

        if ((item.slotCapacities?.length ?? 0) > 0) {
          await tx.availabilitySlotCapacity.createMany({
            data: item.slotCapacities!.map((slot) => ({
              specificDateAvailabilityId: availability.id,
              startTime: slot.startTime,
              capacity: slot.capacity,
            })),
          });
        }
      }
    });

    return this.getSpecificDates(professionalId);
  }

  getSpecificDates(professionalId: string) {
    return this.prisma.specificDateAvailability.findMany({
      where: { professionalId },
      include: {
        ranges: {
          orderBy: { startTime: 'asc' },
        },
        slotCapacities: {
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getSlots(professionalId: string, dateString: string) {
    const targetDate = new Date(dateString);
    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: {
        consultationMinutes: true,
        bufferMinutes: true,
      },
    });

    const specificDate = await this.prisma.specificDateAvailability.findUnique({
      where: { professionalId_date: { professionalId, date: targetDate } },
      include: { ranges: true, slotCapacities: true },
    });

    let ranges: {
      startTime: string;
      endTime: string;
      capacity: number | null;
    }[] = [];
    let slotCapacityMap = new Map<string, number>();

    if (specificDate?.isEnabled) {
      ranges = specificDate.ranges;
      slotCapacityMap = new Map(
        specificDate.slotCapacities.map((slot) => [
          slot.startTime,
          slot.capacity,
        ]),
      );
    } else if (!specificDate) {
      const weekday = this.dateToWeekday(targetDate);
      const weekly = await this.prisma.weeklyAvailability.findUnique({
        where: {
          professionalId_weekday: {
            professionalId,
            weekday,
          },
        },
        include: { ranges: true },
      });
      if (weekly?.isEnabled) {
        ranges = weekly.ranges;
      }
    }

    const dayStart = setTimeOnDate(targetDate, '00:00');
    const dayEnd = setTimeOnDate(targetDate, '23:59');
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        startAt: { gte: dayStart, lte: dayEnd },
        status: {
          not: 'CANCELLED',
        },
      },
      select: { startAt: true, endAt: true },
    });

    const slotMs =
      (professional.consultationMinutes + professional.bufferMinutes) * 60000;
    const slots: {
      startAt: string;
      endAt: string;
      bookedCount: number;
      remainingCapacity: number | null;
      hasCapacityLimit: boolean;
    }[] = [];

    for (const range of ranges) {
      let cursor = setTimeOnDate(targetDate, range.startTime);
      const rangeEnd = setTimeOnDate(targetDate, range.endTime);

      while (
        cursor.getTime() + professional.consultationMinutes * 60000 <=
        rangeEnd.getTime()
      ) {
        const slotEnd = addMinutes(cursor, professional.consultationMinutes);
        const bookedCount = existingAppointments.filter(
          (appointment) =>
            cursor < appointment.endAt && slotEnd > appointment.startAt,
        ).length;

        const slotTimeKey = this.toTimeKey(cursor);
        const capacityFromSlot = slotCapacityMap.get(slotTimeKey);
        const effectiveCapacity = capacityFromSlot ?? range.capacity ?? null;
        const remainingCapacity =
          effectiveCapacity === null
            ? null
            : Math.max(0, effectiveCapacity - bookedCount);

        slots.push({
          startAt: cursor.toISOString(),
          endAt: slotEnd.toISOString(),
          bookedCount,
          remainingCapacity,
          hasCapacityLimit: effectiveCapacity !== null,
        });

        cursor = new Date(cursor.getTime() + slotMs);
      }
    }

    return { date: targetDate.toISOString(), slots };
  }

  private dateToWeekday(date: Date): Weekday {
    const map: Record<number, Weekday> = {
      0: Weekday.SUNDAY,
      1: Weekday.MONDAY,
      2: Weekday.TUESDAY,
      3: Weekday.WEDNESDAY,
      4: Weekday.THURSDAY,
      5: Weekday.FRIDAY,
      6: Weekday.SATURDAY,
    };

    return map[date.getUTCDay()] ?? Weekday.MONDAY;
  }

  private toTimeKey(date: Date): string {
    return date.toLocaleTimeString('en-GB', {
      timeZone: ARG_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
