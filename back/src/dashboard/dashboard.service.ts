import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessContext } from '../common/tenant/access-context';
import {
  calendarDateKeyInTimeZone,
  resolveCalendarRangeInTimeZone,
} from '../common/utils/calendar-range.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(ctx: AccessContext) {
    if (ctx.role === 'CENTER_ADMIN') {
      return this.centerStats(ctx.organizationId);
    }
    return this.professionalStats(ctx.professionalId);
  }

  private async centerStats(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const tz = org.timezone;
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { start: todayStart, end: todayEnd } = resolveCalendarRangeInTimeZone(
      'day',
      now,
      tz,
    );
    const { start: monthStart, end: monthEnd } = resolveCalendarRangeInTimeZone(
      'month',
      now,
      tz,
    );
    const { start: weekStart, end: weekEnd } = resolveCalendarRangeInTimeZone(
      'week',
      now,
      tz,
    );

    // Batch 1: lightweight counts + monthly appointments (combined)
    const [
      totalProfessionals,
      totalPatients,
      monthlyAppointments,
      revenues,
      expenses,
    ] = await Promise.all([
      this.prisma.professional.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.patient.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.appointment.findMany({
        where: {
          organizationId,
          startAt: { gte: monthStart, lte: monthEnd },
          status: { not: AppointmentStatus.CANCELLED },
        },
        select: { status: true },
      }),
      this.prisma.revenue.aggregate({
        where: {
          organizationId,
          occurredAt: { gte: monthStart, lte: monthEnd },
        } as any,
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          organizationId,
          occurredAt: { gte: monthStart, lte: monthEnd },
        } as any,
        _sum: { amount: true },
      }),
    ]);

    const appointmentsThisMonth = monthlyAppointments.length;
    const attendedThisMonth = monthlyAppointments.filter(
      (a) => a.status === AppointmentStatus.ATTENDED,
    ).length;

    // Batch 2: weekly chart data + today counts + pending
    const [appointmentsThisWeekAll, appointmentsToday, pendingNext24h] =
      await Promise.all([
        this.prisma.appointment.findMany({
          where: {
            organizationId,
            startAt: { gte: weekStart, lte: weekEnd },
            status: { not: AppointmentStatus.CANCELLED },
          },
          select: { startAt: true, status: true },
        }),
        this.prisma.appointment.count({
          where: {
            organizationId,
            startAt: { gte: todayStart, lte: todayEnd },
            status: { not: AppointmentStatus.CANCELLED },
          },
        }),
        this.prisma.appointment.count({
          where: {
            organizationId,
            status: AppointmentStatus.PENDING,
            startAt: { gte: now, lte: next24h },
          },
        }),
      ]);

    // Batch 3: upcoming + professional breakdown
    const [upcomingToday, professionals] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          organizationId,
          startAt: { gte: now, lte: todayEnd },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
        },
        orderBy: { startAt: 'asc' },
        take: 8,
        select: {
          id: true,
          startAt: true,
          status: true,
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
          professional: {
            select: { id: true, fullName: true, specialty: true },
          },
        },
      }),
      this.prisma.professional.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          fullName: true,
          specialty: true,
          _count: {
            select: {
              appointments: {
                where: {
                  startAt: { gte: monthStart, lte: monthEnd },
                  status: { not: AppointmentStatus.CANCELLED },
                },
              },
            },
          },
        },
      }),
    ]);

    const revenue = Number(revenues._sum?.amount ?? 0);
    const expense = Number(expenses._sum?.amount ?? 0);
    const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const weekStartLocal = DateTime.fromJSDate(weekStart).setZone(tz);
    const weeklyChart = Array.from({ length: 7 }, (_, i) => {
      const dateStr = weekStartLocal.plus({ days: i }).toFormat('yyyy-MM-dd');
      const dayAppointments = appointmentsThisWeekAll.filter(
        (a) => calendarDateKeyInTimeZone(new Date(a.startAt), tz) === dateStr,
      );

      return {
        day: DAY_LABELS[i],
        total: dayAppointments.length,
        attended: dayAppointments.filter(
          (a) => a.status === AppointmentStatus.ATTENDED,
        ).length,
      };
    });

    const professionalBreakdown = professionals.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      specialty: p.specialty,
      appointmentsThisMonth: p._count.appointments,
    }));

    const occupancyPercent =
      appointmentsThisMonth > 0
        ? Number(((attendedThisMonth / appointmentsThisMonth) * 100).toFixed(1))
        : 0;

    return {
      totalProfessionals,
      totalPatients,
      appointmentsToday,
      appointmentsThisWeek: appointmentsThisWeekAll.length,
      appointmentsThisMonth,
      pendingNext24h,
      upcomingToday,
      weeklyChart,
      financeThisMonth: {
        income: revenue,
        expense,
        net: revenue - expense,
        occupancyPercent,
        attendedCount: attendedThisMonth,
      },
      revenueThisMonth: revenue,
      professionals: professionalBreakdown,
    };
  }

  private async professionalStats(professionalId: string) {
    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: { timezone: true },
    });
    const tz = professional.timezone;

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { start: weekStart, end: weekEnd } = resolveCalendarRangeInTimeZone(
      'week',
      now,
      tz,
    );
    const { start: todayStart, end: todayEnd } = resolveCalendarRangeInTimeZone(
      'day',
      now,
      tz,
    );
    const { start: monthStart, end: monthEnd } = resolveCalendarRangeInTimeZone(
      'month',
      now,
      tz,
    );

    // Batch 1: patient counts + monthly appointment statuses + finance
    const [
      patientsTotal,
      patientsThisWeek,
      monthlyAppointments,
      revenues,
      expenses,
      pendingNext24h,
    ] = await Promise.all([
      this.prisma.patient.count({
        where: { professionalId, deletedAt: null },
      }),
      this.prisma.patient.count({
        where: {
          professionalId,
          deletedAt: null,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          professionalId,
          startAt: { gte: monthStart, lte: monthEnd },
          status: { not: AppointmentStatus.CANCELLED },
        },
        select: { status: true },
      }),
      this.prisma.revenue.aggregate({
        where: {
          professionalId,
          occurredAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          professionalId,
          occurredAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.appointment.count({
        where: {
          professionalId,
          status: AppointmentStatus.PENDING,
          startAt: { gte: now, lte: next24h },
        },
      }),
    ]);

    const totalThisMonth = monthlyAppointments.length;
    const attendedThisMonth = monthlyAppointments.filter(
      (a) => a.status === AppointmentStatus.ATTENDED,
    ).length;

    // Batch 2: weekly + today + upcoming + next appointment
    const [
      appointmentsThisWeekAll,
      appointmentsToday,
      upcomingToday,
      nextAppointmentRaw,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          professionalId,
          startAt: { gte: weekStart, lte: weekEnd },
          status: { not: AppointmentStatus.CANCELLED },
        },
        select: { startAt: true, status: true },
      }),
      this.prisma.appointment.count({
        where: {
          professionalId,
          startAt: { gte: todayStart, lte: todayEnd },
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          professionalId,
          startAt: { gte: now, lte: todayEnd },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
        },
        orderBy: { startAt: 'asc' },
        take: 6,
        select: {
          id: true,
          startAt: true,
          status: true,
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.appointment.findFirst({
        where: {
          professionalId,
          startAt: { gte: now },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
        },
        orderBy: { startAt: 'asc' },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          reason: true,
          durationMinutes: true,
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const income = Number(revenues._sum?.amount ?? 0);
    const expense = Number(expenses._sum?.amount ?? 0);
    const occupancyPercent =
      totalThisMonth > 0
        ? Number(((attendedThisMonth / totalThisMonth) * 100).toFixed(1))
        : 0;

    const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const weekStartLocal = DateTime.fromJSDate(weekStart).setZone(tz);
    const weeklyChart = Array.from({ length: 7 }, (_, i) => {
      const dateStr = weekStartLocal.plus({ days: i }).toFormat('yyyy-MM-dd');

      const dayApps = appointmentsThisWeekAll.filter(
        (a) => calendarDateKeyInTimeZone(new Date(a.startAt), tz) === dateStr,
      );

      return {
        day: DAY_LABELS[i],
        total: dayApps.length,
        attended: dayApps.filter((a) => a.status === AppointmentStatus.ATTENDED)
          .length,
      };
    });

    const nextAppointment = nextAppointmentRaw
      ? {
          ...nextAppointmentRaw,
          minutesUntilStart: Math.max(
            0,
            Math.round(
              (new Date(nextAppointmentRaw.startAt).getTime() - now.getTime()) /
                60000,
            ),
          ),
        }
      : null;

    return {
      patientsTotal,
      patientsThisWeek,
      appointmentsThisWeek: appointmentsThisWeekAll.length,
      appointmentsToday,
      upcomingToday,
      pendingNext24h,
      nextAppointment,
      financeThisMonth: {
        income,
        expense,
        net: income - expense,
        occupancyPercent,
        attendedCount: attendedThisMonth,
      },
      weeklyChart,
    };
  }
}
