import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentModality,
  AppointmentStatus,
  Prisma,
  Weekday,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessContext } from '../common/tenant/access-context';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { ListAppointmentsDto } from './dto/list-appointments.dto';
import { ChangeAppointmentStatusDto } from './dto/change-status.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { addMinutes } from '../common/utils/date.utils';
import { resolveCalendarRangeInTimeZone } from '../common/utils/calendar-range.util';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMessaging: WhatsappMessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(ctx: AccessContext, dto: CreateAppointmentDto) {
    // CENTER_ADMIN must specify professionalId in the DTO
    const professionalId =
      ctx.role === 'CENTER_ADMIN'
        ? dto.professionalId
        : ctx.professionalId;

    if (!professionalId) {
      throw new BadRequestException(
        'Se requiere professionalId para crear un turno como administrador del centro',
      );
    }

    // Verify the professional belongs to the org if CENTER_ADMIN
    if (ctx.role === 'CENTER_ADMIN') {
      const pro = await this.prisma.professional.findFirst({
        where: { id: professionalId, organizationId: ctx.organizationId },
      });
      if (!pro) throw new NotFoundException('Profesional no encontrado en el centro');
    }

    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: {
        consultationMinutes: true,
        bufferMinutes: true,
        standardFee: true,
        reminderHours: true,
        organizationId: true,
      },
    });

    const patient = await this.prisma.patient.findFirst({
      where: {
        id: dto.patientId,
        deletedAt: null,
        ...(ctx.role === 'CENTER_ADMIN' || ctx.role === 'CENTER_MEMBER'
          ? { organizationId: ctx.organizationId }
          : { professionalId }),
      },
    });

    if (!patient) throw new NotFoundException('Paciente no encontrado');

    const startAt = new Date(dto.startAt);
    const duration = dto.durationMinutes ?? professional.consultationMinutes;
    const endAt = addMinutes(startAt, duration);

    await this.ensureSlotAvailable(professionalId, startAt, endAt);

    const created = await this.prisma.appointment.create({
      data: {
        professionalId,
        organizationId: professional.organizationId ?? null,
        patientId: patient.id,
        startAt,
        endAt,
        durationMinutes: duration,
        bufferMinutes: professional.bufferMinutes,
        fee: new Prisma.Decimal(dto.fee ?? professional.standardFee),
        reason: dto.reason?.trim(),
        modality: dto.modality ?? AppointmentModality.PRESENCIAL,
        reminderScheduledFor: addMinutes(
          startAt,
          -professional.reminderHours * 60,
        ),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (dto.paymentMethod) {
      await this.prisma.revenue.upsert({
        where: { appointmentId: created.id },
        create: {
          professionalId,
          appointmentId: created.id,
          amount: created.fee,
          occurredAt: created.startAt,
          paymentMethod: dto.paymentMethod,
        },
        update: {
          paymentMethod: dto.paymentMethod,
        },
      });
    }

    void this.whatsappMessaging
      .sendAppointmentCreated(created.id)
      .catch(() => undefined);

    return created;
  }

  async list(ctx: AccessContext, query: ListAppointmentsDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.AppointmentWhereInput = {
      ...this.buildAppointmentWhereFromCtx(ctx, query.professionalId),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search?.trim()
        ? {
            patient: {
              OR: [
                {
                  firstName: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
                { phone: { contains: query.search.trim() } },
                { dni: { contains: query.search.trim(), mode: 'insensitive' } },
                { email: { contains: query.search.trim(), mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { startAt: 'desc' },
include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        ...(isMultiProfessional
          ? {
              professional: {
                select: {
                  id: true,
                  fullName: true,
                  specialty: true,
                },
              },
            }
          : {}),
      },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async calendar(ctx: AccessContext, query: CalendarQueryDto) {
    // For CENTER_ADMIN calendar: use provided professionalId or org timezone
    const professionalId =
      ctx.role === 'CENTER_ADMIN'
        ? (query as any).professionalId as string | undefined
        : ctx.professionalId;

    const timezone = isMultiProfessional
      ? (
          await this.prisma.organization.findUniqueOrThrow({
            where: { id: ctx.organizationId },
            select: { timezone: true },
          })
        ).timezone
      : (query as any).professionalId
        ? (
            await this.prisma.professional.findUniqueOrThrow({
              where: { id: (query as any).professionalId },
              select: { timezone: true },
            })
          ).timezone
        : ctx.professionalId
          ? (
              await this.prisma.professional.findUniqueOrThrow({
                where: { id: ctx.professionalId },
                select: { timezone: true },
              })
            ).timezone
          : 'America/Argentina/Buenos_Aires';

    const date = new Date(query.date);
    const range = resolveCalendarRangeInTimeZone(
      query.view ?? 'week',
      date,
      timezone,
    );

    const isMultiProfessional =
      ctx.role === 'CENTER_ADMIN' && query.professionalIds?.length;

    const where: Prisma.AppointmentWhereInput = {
      organizationId: isMultiProfessional ? ctx.organizationId : undefined,
      professionalId: isMultiProfessional
        ? undefined
        : ctx.role === 'CENTER_ADMIN'
          ? (query as any).professionalId
          : ctx.professionalId,
      ...(isMultiProfessional && query.professionalIds.length
        ? { professionalId: { in: query.professionalIds } }
        : {}),
      startAt: {
        gte: range.start,
        lte: range.end,
      },
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
    };

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const patientIds = [...new Set(appointments.map((a) => a.patientId))];
    const absentCounts =
      patientIds.length > 0
        ? await this.prisma.appointment.groupBy({
            by: ['patientId'],
            where: {
              organizationId: ctx.organizationId,
              patientId: { in: patientIds },
              status: AppointmentStatus.ABSENT,
            },
            _count: { id: true },
          })
        : [];
    const absentMap = new Map(
      absentCounts.map((r) => [r.patientId, r._count.id]),
    );

    return {
      view: query.view ?? 'week',
      from: range.start,
      to: range.end,
      items: appointments.map((a) => ({
        ...a,
        patient: {
          ...a.patient,
          absentCount: absentMap.get(a.patientId) ?? 0,
        },
      })),
    };
  }

  async getOne(ctx: AccessContext, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...this.buildAppointmentWhereFromCtx(ctx),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (!appointment) throw new NotFoundException('Turno no encontrado');

    const absentCount = await this.prisma.appointment.count({
      where: {
        ...this.buildAppointmentWhereFromCtx(ctx),
        patientId: appointment.patientId,
        status: AppointmentStatus.ABSENT,
      },
    });

    return {
      ...appointment,
      patient: { ...appointment.patient, absentCount },
    };
  }

  async changeStatus(
    ctx: AccessContext,
    appointmentId: string,
    dto: ChangeAppointmentStatusDto,
  ) {
    const appointment = await this.getOwnedAppointment(ctx, appointmentId);

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede cambiar estado de un turno cancelado',
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: dto.status,
        attendedAt:
          dto.status === AppointmentStatus.ATTENDED ? new Date() : null,
      },
    });

    if (dto.status === AppointmentStatus.ATTENDED) {
      await this.prisma.revenue.upsert({
        where: { appointmentId: appointment.id },
        create: {
          professionalId: appointment.professionalId,
          appointmentId: appointment.id,
          amount: appointment.fee,
          occurredAt: appointment.startAt,
          paymentMethod: dto.paymentMethod ?? null,
        },
        update: {
          amount: appointment.fee,
          occurredAt: appointment.startAt,
          paymentMethod: dto.paymentMethod ?? undefined,
        },
      });
    }

    // Feature C: WA + in-app notification cuando el profesional cancela
    if (dto.status === AppointmentStatus.CANCELLED) {
      void this.prisma.appointment
        .update({
          where: { id: appointment.id },
          data: { cancelledAt: new Date() },
        })
        .catch(() => undefined);
      void this.whatsappMessaging
        .sendAppointmentCancelledByProfessional(appointment.id)
        .catch(() => undefined);
    }

    return updated;
  }

  async reschedule(
    ctx: AccessContext,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
  ) {
    const appointment = await this.getOwnedAppointment(ctx, appointmentId);
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede reprogramar un turno cancelado',
      );
    }

    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: appointment.professionalId },
      select: { reminderHours: true },
    });

    const startAt = new Date(dto.startAt);
    const endAt = addMinutes(startAt, appointment.durationMinutes);
    await this.ensureSlotAvailable(
      appointment.professionalId,
      startAt,
      endAt,
      appointment.id,
    );

    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startAt,
        endAt,
        reason: dto.reason ?? appointment.reason,
        reminderScheduledFor: addMinutes(
          startAt,
          -professional.reminderHours * 60,
        ),
        reminderJobId: null,
        reminderSentAt: null,
      },
    });

    // Feature B: WA al paciente + in-app notification
    void this.whatsappMessaging
      .sendAppointmentRescheduled(updated.id)
      .catch(() => undefined);

    return updated;
  }

  async cancel(
    ctx: AccessContext,
    appointmentId: string,
    dto: CancelAppointmentDto,
  ) {
    const appointment = await this.getOwnedAppointment(ctx, appointmentId);

    if (appointment.status === AppointmentStatus.CANCELLED) {
      return appointment;
    }

    return this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        reason: dto.reason ?? appointment.reason,
        reminderJobId: null,
      },
    });
  }

  private async getOwnedAppointment(ctx: AccessContext, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...this.buildAppointmentWhereFromCtx(ctx),
      },
    });
    if (!appointment) throw new NotFoundException('Turno no encontrado');
    return appointment;
  }

  private buildAppointmentWhereFromCtx(
    ctx: AccessContext,
    overrideProfessionalId?: string | null,
  ): Prisma.AppointmentWhereInput {
    if (ctx.role === 'CENTER_ADMIN') {
      return {
        organizationId: ctx.organizationId,
        ...(overrideProfessionalId ? { professionalId: overrideProfessionalId } : {}),
      };
    }
    return { professionalId: ctx.professionalId };
  }

  private async ensureSlotAvailable(
    professionalId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ) {
    const slotContext = await this.resolveSlotContext(
      professionalId,
      startAt,
      endAt,
    );
    const overlappingCount = await this.prisma.appointment.count({
      where: {
        professionalId,
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        status: { not: AppointmentStatus.CANCELLED },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    });

    if (
      slotContext.capacity !== null &&
      overlappingCount >= slotContext.capacity
    ) {
      throw new BadRequestException(
        'No hay cupos disponibles para este horario',
      );
    }
  }

  private async resolveSlotContext(
    professionalId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<{ capacity: number | null }> {
    const targetDate = new Date(startAt);
    targetDate.setUTCHours(0, 0, 0, 0);

    const specificDate = await this.prisma.specificDateAvailability.findUnique({
      where: { professionalId_date: { professionalId, date: targetDate } },
      include: {
        ranges: true,
        slotCapacities: true,
      },
    });

    if (specificDate) {
      if (!specificDate.isEnabled) {
        throw new BadRequestException(
          'No hay disponibilidad para la fecha seleccionada',
        );
      }
      return this.matchRangeWithCapacity(
        startAt,
        endAt,
        specificDate.ranges,
        new Map(
          specificDate.slotCapacities.map((slot) => [
            slot.startTime,
            slot.capacity,
          ]),
        ),
      );
    }

    const weekly = await this.prisma.weeklyAvailability.findUnique({
      where: {
        professionalId_weekday: {
          professionalId,
          weekday: this.dateToWeekday(startAt),
        },
      },
      include: { ranges: true },
    });

    if (!weekly?.isEnabled) {
      throw new BadRequestException(
        'No hay disponibilidad para el día seleccionado',
      );
    }

    return this.matchRangeWithCapacity(
      startAt,
      endAt,
      weekly.ranges,
      new Map(),
    );
  }

  private matchRangeWithCapacity(
    startAt: Date,
    endAt: Date,
    ranges: Array<{
      startTime: string;
      endTime: string;
      capacity: number | null;
    }>,
    slotCapacities: Map<string, number>,
  ): { capacity: number | null } {
    const matchingRange = ranges.find((range) => {
      const rangeStart = this.setTimeOnDate(startAt, range.startTime);
      const rangeEnd = this.setTimeOnDate(startAt, range.endTime);
      return startAt >= rangeStart && endAt <= rangeEnd;
    });

    if (!matchingRange) {
      throw new BadRequestException(
        'El horario seleccionado está fuera de tu disponibilidad',
      );
    }

    const slotKey = this.toTimeKey(startAt);
    return {
      capacity: slotCapacities.get(slotKey) ?? matchingRange.capacity ?? null,
    };
  }

  private setTimeOnDate(baseDate: Date, time: string): Date {
    const [hourString, minuteString] = time.split(':');
    const hour = Number(hourString);
    const minute = Number(minuteString);
    const date = new Date(baseDate);
    date.setUTCHours(hour + 3, minute, 0, 0);
    return date;
  }

  private toTimeKey(date: Date): string {
    return date.toLocaleTimeString('en-GB', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
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
}
