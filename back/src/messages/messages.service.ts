import { Injectable } from '@nestjs/common';
import { MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessContext } from '../common/tenant/access-context';
import { ListMessagesDto } from './dto/list-messages.dto';
import { GroupedMessagesDto } from './dto/grouped-messages.dto';

const messageLogSelect = {
  id: true,
  direction: true,
  messageType: true,
  content: true,
  toPhone: true,
  fromPhone: true,
  sentAt: true,
  receivedAt: true,
  createdAt: true,
  appointmentId: true,
  patientId: true,
  patient: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.MessageLogSelect;

export type MessageLogListItem = Prisma.MessageLogGetPayload<{
  select: typeof messageLogSelect;
}>;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: AccessContext, query: ListMessagesDto) {
    const skip = (query.page - 1) * query.limit;
    const where = this.buildWhere(ctx, {
      patientId: query.patientId,
      messageTypes: query.messageTypes,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.messageLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: messageLogSelect,
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async groupedByPatient(ctx: AccessContext, query: GroupedMessagesDto) {
    const skip = (query.page - 1) * query.limit;

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) createdAtFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) createdAtFilter.lte = new Date(query.dateTo);

    const dateFilter: Prisma.MessageLogWhereInput = {};
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = createdAtFilter;
    }

    const patientBaseWhere: Prisma.PatientWhereInput =
      ctx.role === 'CENTER_ADMIN'
        ? { organizationId: ctx.organizationId, deletedAt: null }
        : ctx.role === 'CENTER_MEMBER'
          ? {
              organizationId: ctx.organizationId,
              deletedAt: null,
              appointments: { some: { professionalId: ctx.professionalId } },
            }
          : { professionalId: ctx.professionalId, deletedAt: null };

    const patientWhere: Prisma.PatientWhereInput = {
      ...patientBaseWhere,
      ...(query.search
        ? {
            OR: [
              {
                firstName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      messageLogs: { some: { ...dateFilter } },
    };

    const [patients, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where: patientWhere,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          messageLogs: {
            where: dateFilter,
            select: {
              messageType: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.patient.count({ where: patientWhere }),
    ]);

    const items = patients.map((p) => {
      const typeCounts: Partial<Record<MessageType, number>> = {};
      let lastMessageAt: Date | null = null;

      for (const ml of p.messageLogs) {
        typeCounts[ml.messageType] = (typeCounts[ml.messageType] ?? 0) + 1;
        if (!lastMessageAt || ml.createdAt > lastMessageAt) {
          lastMessageAt = ml.createdAt;
        }
      }

      return {
        patientId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        totalMessages: p.messageLogs.length,
        typeCounts,
        lastMessageAt,
      };
    });

    items.sort((a, b) => {
      const aDate = a.lastMessageAt ?? new Date(0);
      const bDate = b.lastMessageAt ?? new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async countsByType(ctx: AccessContext) {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const baseWhere: Prisma.MessageLogWhereInput =
      ctx.role === 'CENTER_ADMIN'
        ? { organizationId: ctx.organizationId }
        : { professionalId: ctx.professionalId };

    const rows = await this.prisma.messageLog.groupBy({
      by: ['messageType'],
      where: { ...baseWhere, createdAt: { gte: since } },
      _count: { id: true },
    });

    const byType: Partial<Record<MessageType, number>> = {};
    for (const r of rows) {
      const cnt = r._count;
      byType[r.messageType] =
        typeof cnt === 'object' && cnt ? ((cnt as any).id ?? 0) : 0;
    }
    return { since: since.toISOString(), byType };
  }

  private buildWhere(
    ctx: AccessContext,
    opts: {
      patientId?: string;
      messageTypes?: MessageType[];
      dateFrom?: string;
      dateTo?: string;
    },
  ): Prisma.MessageLogWhereInput {
    const where: Prisma.MessageLogWhereInput =
      ctx.role === 'CENTER_ADMIN'
        ? { organizationId: ctx.organizationId }
        : { professionalId: ctx.professionalId };

    if (opts.patientId) where.patientId = opts.patientId;
    if (opts.messageTypes?.length) {
      where.messageType = { in: opts.messageTypes };
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.dateFrom) createdAt.gte = new Date(opts.dateFrom);
    if (opts.dateTo) createdAt.lte = new Date(opts.dateTo);
    if (opts.dateFrom || opts.dateTo) where.createdAt = createdAt;

    return where;
  }
}
