import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessContext } from '../common/tenant/access-context';
import { FinanceSummaryQueryDto } from './dto/summary-query.dto';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { FinanceMovementScope } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { endOfMonth, startOfMonth } from '../common/utils/date.utils';
import { FinanceListQueryDto } from './dto/list-finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ctx: AccessContext, query: FinanceSummaryQueryDto) {
    const base = query.month ? new Date(query.month) : new Date();
    const from = startOfMonth(base);
    const to = endOfMonth(base);

    const isOrgAdmin = ctx.role === 'CENTER_ADMIN';
    const financeFilter = await this.buildFinanceWhere(ctx, query);
    const apptFilter =
      isOrgAdmin && query.professionalId
        ? {
            organizationId: ctx.organizationId,
            professionalId: query.professionalId,
          }
        : isOrgAdmin
          ? { organizationId: ctx.organizationId }
          : { professionalId: ctx.professionalId };

    const [revenues, expenses, attendedCount, absentCount, totalAppointments] =
      await Promise.all([
        this.prisma.revenue.aggregate({
          where: {
            ...financeFilter,
            occurredAt: { gte: from, lte: to },
          } as any,
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            ...financeFilter,
            occurredAt: { gte: from, lte: to },
          } as any,
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

  async listRevenues(ctx: AccessContext, query: FinanceListQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where = await this.buildFinanceWhere(ctx, query);

    return this.prisma.revenue.findMany({
      where: where as any,
      skip,
      take: query.limit,
      orderBy: { occurredAt: 'desc' },
      include:
        ctx.role === 'CENTER_ADMIN'
          ? {
              professional: {
                select: { id: true, fullName: true, specialty: true },
              },
            }
          : undefined,
    });
  }

  async createRevenue(ctx: AccessContext, dto: CreateRevenueDto) {
    const owner = await this.resolveMovementOwner(
      ctx,
      dto.scope,
      dto.professionalId,
    );
    return this.prisma.revenue.create({
      data: {
        ...owner,
        appointmentId: dto.appointmentId,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.occurredAt),
        notes: dto.notes,
      } as any,
      include:
        ctx.role === 'CENTER_ADMIN'
          ? {
              professional: {
                select: { id: true, fullName: true, specialty: true },
              },
            }
          : undefined,
    });
  }

  async updateRevenue(ctx: AccessContext, id: string, dto: UpdateRevenueDto) {
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? {
            id,
            OR: [
              { organizationId: ctx.organizationId },
              { professional: { organizationId: ctx.organizationId } },
            ],
          }
        : { id, professionalId: ctx.professionalId };
    const existing = await this.prisma.revenue.findFirst({
      where: where as any,
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

  async listExpenses(ctx: AccessContext, query: FinanceListQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where = await this.buildFinanceWhere(ctx, query);

    return this.prisma.expense.findMany({
      where: where as any,
      skip,
      take: query.limit,
      orderBy: { occurredAt: 'desc' },
      include:
        ctx.role === 'CENTER_ADMIN'
          ? {
              professional: {
                select: { id: true, fullName: true, specialty: true },
              },
            }
          : undefined,
    });
  }

  async createExpense(ctx: AccessContext, dto: CreateExpenseDto) {
    const owner = await this.resolveMovementOwner(
      ctx,
      dto.scope,
      dto.professionalId,
    );
    return this.prisma.expense.create({
      data: {
        ...owner,
        concept: dto.concept,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.occurredAt),
      } as any,
      include:
        ctx.role === 'CENTER_ADMIN'
          ? {
              professional: {
                select: { id: true, fullName: true, specialty: true },
              },
            }
          : undefined,
    });
  }

  async updateExpense(ctx: AccessContext, id: string, dto: UpdateExpenseDto) {
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? {
            id,
            OR: [
              { organizationId: ctx.organizationId },
              { professional: { organizationId: ctx.organizationId } },
            ],
          }
        : { id, professionalId: ctx.professionalId };
    const existing = await this.prisma.expense.findFirst({
      where: where as any,
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

  async removeExpense(ctx: AccessContext, id: string) {
    const where =
      ctx.role === 'CENTER_ADMIN'
        ? {
            id,
            OR: [
              { organizationId: ctx.organizationId },
              { professional: { organizationId: ctx.organizationId } },
            ],
          }
        : { id, professionalId: ctx.professionalId };
    const existing = await this.prisma.expense.findFirst({
      where: where as any,
    });
    if (!existing) throw new NotFoundException('Egreso no encontrado');
    await this.prisma.expense.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async buildFinanceWhere(
    ctx: AccessContext,
    query: Pick<FinanceListQueryDto, 'scope' | 'professionalId'>,
  ): Promise<Record<string, unknown>> {
    if (ctx.role !== 'CENTER_ADMIN') {
      return { professionalId: ctx.professionalId };
    }

    if (query.professionalId) {
      await this.ensureProfessionalInOrganization(
        query.professionalId,
        ctx.organizationId,
      );
      return {
        professionalId: query.professionalId,
        OR: [
          { organizationId: ctx.organizationId },
          { professional: { organizationId: ctx.organizationId } },
        ],
      };
    }

    if (query.scope === FinanceMovementScope.CENTER) {
      return { organizationId: ctx.organizationId, professionalId: null };
    }

    if (query.scope === FinanceMovementScope.PROFESSIONAL) {
      return { professional: { organizationId: ctx.organizationId } };
    }

    return {
      OR: [
        { organizationId: ctx.organizationId },
        { professional: { organizationId: ctx.organizationId } },
      ],
    };
  }

  private async resolveMovementOwner(
    ctx: AccessContext,
    scope?: FinanceMovementScope,
    professionalId?: string,
  ): Promise<{
    professionalId?: string | null;
    organizationId?: string | null;
  }> {
    if (ctx.role !== 'CENTER_ADMIN') {
      return { professionalId: ctx.professionalId, organizationId: null };
    }

    const effectiveScope = scope ?? FinanceMovementScope.CENTER;
    if (effectiveScope === FinanceMovementScope.CENTER) {
      if (professionalId) {
        throw new BadRequestException(
          'professionalId no corresponde para movimientos de alcance CENTER',
        );
      }
      return { organizationId: ctx.organizationId, professionalId: null };
    }

    if (!professionalId) {
      throw new BadRequestException(
        'professionalId es requerido para movimientos de alcance PROFESSIONAL',
      );
    }

    await this.ensureProfessionalInOrganization(
      professionalId,
      ctx.organizationId,
    );

    return { organizationId: ctx.organizationId, professionalId };
  }

  private async ensureProfessionalInOrganization(
    professionalId: string,
    organizationId: string,
  ) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId },
      select: { id: true },
    });
    if (!professional) {
      throw new NotFoundException('Profesional no encontrado en el centro');
    }
  }
}
