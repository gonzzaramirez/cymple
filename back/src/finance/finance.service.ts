import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { FinanceSummaryQueryDto } from './dto/summary-query.dto';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { endOfMonth, startOfMonth } from '../common/utils/date.utils';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(professionalId: string, query: FinanceSummaryQueryDto) {
    const base = query.month ? new Date(query.month) : new Date();
    const from = startOfMonth(base);
    const to = endOfMonth(base);

    const [revenues, expenses, attendedCount, absentCount, totalAppointments] =
      await Promise.all([
        this.prisma.revenue.aggregate({
          where: {
            professionalId,
            occurredAt: { gte: from, lte: to },
          },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            professionalId,
            occurredAt: { gte: from, lte: to },
          },
          _sum: { amount: true },
        }),
        this.prisma.appointment.count({
          where: {
            professionalId,
            status: AppointmentStatus.ATTENDED,
            startAt: { gte: from, lte: to },
          },
        }),
        this.prisma.appointment.count({
          where: {
            professionalId,
            status: AppointmentStatus.ABSENT,
            startAt: { gte: from, lte: to },
          },
        }),
        this.prisma.appointment.count({
          where: {
            professionalId,
            startAt: { gte: from, lte: to },
            status: { not: AppointmentStatus.CANCELLED },
          },
        }),
      ]);

    const income = Number(revenues._sum.amount ?? 0);
    const outcome = Number(expenses._sum.amount ?? 0);
    const occupancy =
      totalAppointments > 0 ? (attendedCount / totalAppointments) * 100 : 0;

    return {
      month: from.toISOString(),
      totals: {
        income,
        expense: outcome,
        net: income - outcome,
        attendedCount,
        absentCount,
        occupancyPercent: Number(occupancy.toFixed(2)),
      },
    };
  }

  listRevenues(professionalId: string, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    return this.prisma.revenue.findMany({
      where: { professionalId },
      skip,
      take: query.limit,
      orderBy: { occurredAt: 'desc' },
    });
  }

  createRevenue(professionalId: string, dto: CreateRevenueDto) {
    return this.prisma.revenue.create({
      data: {
        professionalId,
        appointmentId: dto.appointmentId,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.occurredAt),
        notes: dto.notes,
      },
    });
  }

  async updateRevenue(
    professionalId: string,
    id: string,
    dto: UpdateRevenueDto,
  ) {
    const existing = await this.prisma.revenue.findFirst({
      where: { id, professionalId },
    });
    if (!existing) throw new NotFoundException('Ingreso no encontrado');

    return this.prisma.revenue.update({
      where: { id },
      data: {
        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        notes: dto.notes,
      },
    });
  }

  listExpenses(professionalId: string, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    return this.prisma.expense.findMany({
      where: { professionalId },
      skip,
      take: query.limit,
      orderBy: { occurredAt: 'desc' },
    });
  }

  createExpense(professionalId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        professionalId,
        concept: dto.concept,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.occurredAt),
      },
    });
  }

  async updateExpense(
    professionalId: string,
    id: string,
    dto: UpdateExpenseDto,
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, professionalId },
    });
    if (!existing) throw new NotFoundException('Egreso no encontrado');

    return this.prisma.expense.update({
      where: { id },
      data: {
        concept: dto.concept,
        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async removeExpense(professionalId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, professionalId },
    });
    if (!existing) throw new NotFoundException('Egreso no encontrado');
    await this.prisma.expense.delete({ where: { id } });
    return { id, deleted: true };
  }
}
