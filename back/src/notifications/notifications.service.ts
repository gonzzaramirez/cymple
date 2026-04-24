import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    professionalId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        professionalId: params.professionalId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      },
    });
  }

  async findRecent(professionalId: string) {
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { professionalId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.notification.count({
        where: { professionalId, readAt: null },
      }),
    ]);
    return { items, unreadCount };
  }

  async markAllRead(professionalId: string) {
    await this.prisma.notification.updateMany({
      where: { professionalId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
