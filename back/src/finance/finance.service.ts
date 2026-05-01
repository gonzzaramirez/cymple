import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessContext } from '../common/tenant/access-context';
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

  async summary(ctx: AccessContext, query: FinanceSummaryQueryDto) {
    const base = query.month ? new Date(query.month) : new Date();
    const from = startOfMonth(base);
    const to = endOfMonth(base);

    const isOrgAdmin = ctx.role === 'CENTER_ADMIN';
    const proFilter = isOrgAdmin
      ? { professional: { organizationId: ctx.organizationId as string } }
      : { professionalId: ctx.professionalId as string };
    const apptFilter = isOrgAdmin
      ? { organizationId: ctx.organizationId as string }
      : { professionalId: ctx.professionalId as string };

    const [revenues, expenses, attendedCount, absentCount, totalAppointments] =
      await Promise.all([
        this.prisma.revenue.aggregate({
          where: { ...proFilter, occurredAt: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: { ...proFilter, occurredAt: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        this.prisma.appointment.count({
          where: {
            ...apptFilter,
            status: AppointmentStatus.ATTENDED,
            startAt: { gte: from, lte: to },
          },
        }),
        this.prisma.appointment.count({
          where: {
            ...apptFilter,
            status: AppointmentStatus.ABSENT,
            startAt: { gte: from, lte: to },
          },
        }),
        this.prisma.appointment.count({
          where: {
            ...apptFilter,
            startAt: { gte: from, lte: to },
            status: { not: AppointmentStatus.CANCELLED },
          },
        }),
      ]);

    const income = Number(revenues._sum?.amount ?? 0);
    const outcome = Number(expenses._sum?.amount ?? 0);
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

  listRevenues(ctx: AccessContext, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? { professional: { organizationId: ctx.organizationId } }
        : { professionalId: ctx.professionalId };

    return this.prisma.revenue.findMany({
      where: where as any,
      skip,
      take: query.limit,
      orderBy: { occurredAt: 'desc' },
      include:
        ctx.role === 'CENTER_ADMIN'
          ? { professional: { select: { id: true, fullName: true } } }
          : undefined,
    });
  }

  createRevenue(ctx: AccessContext, dto: CreateRevenueDto) {
    if (ctx.role === 'CENTER_ADMIN') {
      throw new Error('Centro no puede crear ingresos directamente');
    }
    return this.prisma.revenue.create({
      data: {
        professionalId: ctx.professionalId,
        appointmentId: dto.appointmentId,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.occurredAt),
        notes: dto.notes,
      },
    });
  }

  async updateRevenue(ctx: AccessContext, id: string, dto: UpdateRevenueDto) {
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? { id, professional: { organizationId: ctx.organizationId } }
        : { id, professionalId: ctx.professionalId };
    const existing = await this.prisma.revenue.findFirst({ where: where as any });
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

  listExpenses(ctx: AccessContext, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? { professional: { organizationId: ctx.organizationId } }
        : { professionalId: ctx.professionalId };

    return this.prisma.expense.findMany({
      where: where as any,
      skip,
      take: query.limit,
      orderBy: { occurredAt: 'desc' },
      include:
        ctx.role === 'CENTER_ADMIN'
          ? { professional: { select: { id: true, fullName: true } } }
          : undefined,
    });
  }

  createExpense(ctx: AccessContext, dto: CreateExpenseDto) {
    if (ctx.role === 'CENTER_ADMIN') {
      throw new Error('Centro no puede crear egresos directamente');
    }
    return this.prisma.expense.create({
      data: {
        professionalId: ctx.professionalId,
        concept: dto.concept,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.occurredAt),
      },
    });
  }

  async updateExpense(ctx: AccessContext, id: string, dto: UpdateExpenseDto) {
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? { id, professional: { organizationId: ctx.organizationId } }
        : { id, professionalId: ctx.professionalId };
    const existing = await this.prisma.expense.findFirst({ where: where as any });
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

  async removeExpense(ctx: AccessContext, id: string) {
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? { id, professional: { organizationId: ctx.organizationId } }
        : { id, professionalId: ctx.professionalId };
    const existing = await this.prisma.expense.findFirst({ where: where as any });
    if (!existing) throw new NotFoundException('Egreso no encontrado');
    await this.prisma.expense.delete({ where: { id } });
    return { id, deleted: true };
  }
}
