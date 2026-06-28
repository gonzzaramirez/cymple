import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { Subject, Observable, filter, map, merge, interval } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

interface NotificationCreatedEvent {
  professionalId: string | null;
  organizationId: string | null;
  notification: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notificationSubject =
    new Subject<NotificationCreatedEvent>();

  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    professionalId?: string;
    organizationId?: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
    appointmentId?: string;
    patientId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        professionalId: params.professionalId,
        organizationId: params.organizationId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        metadata: params.metadata ? params.metadata : undefined,
      },
    });

    // Emit event for SSE subscribers — no await, fire-and-forget
    this.notificationSubject.next({
      professionalId: notification.professionalId,
      organizationId: notification.organizationId,
      notification: notification as unknown as Record<string, unknown>,
    });

    return notification;
  }

  /**
   * Subscribe to real-time notifications for a given user/org.
   * Returns an Observable of SSE MessageEvents. Includes a heartbeat
   * every 30s to keep proxies from closing idle connections.
   */
  subscribe(userId: string, isOrg: boolean): Observable<MessageEvent> {
    return merge(
      this.notificationSubject.pipe(
        filter((event) =>
          isOrg
            ? event.organizationId === userId
            : event.professionalId === userId,
        ),
        map(
          (event) =>
            ({
              data: JSON.stringify(event.notification),
              id: String(event.notification.id),
              type: 'notification',
            }) as MessageEvent,
        ),
      ),
      // Heartbeat cada 30s para mantener la conexión viva
      interval(30_000).pipe(
        map(() => ({ type: 'heartbeat', data: '' }) as MessageEvent),
      ),
    );
  }

  async findRecent(id: string, isOrg = false) {
    const where = isOrg ? { organizationId: id } : { professionalId: id };
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
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

  async markRead(id: string, notificationId: string, isOrg = false) {
    const where = isOrg ? { organizationId: id } : { professionalId: id };
    await this.prisma.notification.updateMany({
      where: { ...where, id: notificationId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
