import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    professionalId?: string;
    organizationId?: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        professionalId: params.professionalId,
        organizationId: params.organizationId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      },
    });
  }

  async findRecent(id: string, isOrg = false) {
    const where = isOrg ? { organizationId: id } : { professionalId: id };
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);
    return { items, unreadCount };
  }

  async markAllRead(id: string, isOrg = false) {
    const where = isOrg ? { organizationId: id } : { professionalId: id };
    await this.prisma.notification.updateMany({
      where: { ...where, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
