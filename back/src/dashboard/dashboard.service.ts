import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  calendarDateKeyInTimeZone,
  resolveCalendarRangeInTimeZone,
} from '../common/utils/calendar-range.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(professionalId: string) {
    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: { timezone: true },
    });
    const tz = professional.timezone;

    const now = new Date();

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

    const [
      patientsTotal,
      patientsThisWeek,
      appointmentsThisWeekAll,
      appointmentsToday,
      upcomingToday,
      revenues,
      expenses,
      attendedThisMonth,
      totalThisMonth,
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
          status: AppointmentStatus.ATTENDED,
          startAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.appointment.count({
        where: {
          professionalId,
          startAt: { gte: monthStart, lte: monthEnd },
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
    ]);

    const income = Number(revenues._sum.amount ?? 0);
    const expense = Number(expenses._sum.amount ?? 0);
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

    return {
      patientsTotal,
      patientsThisWeek,
      appointmentsThisWeek: appointmentsThisWeekAll.length,
      appointmentsToday,
      upcomingToday,
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
