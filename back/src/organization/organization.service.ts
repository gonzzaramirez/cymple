import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMemberProfessionalDto } from './dto/create-member-professional.dto';
import { UpdateMemberProfessionalDto } from './dto/update-member-professional.dto';
import { UpdatePublicBookingSettingsDto } from './dto/update-public-booking-settings.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        slug: true,
        name: true,
        email: true,
        phone: true,
        timezone: true,
        waStatus: true,
        waInstanceName: true,
        createdAt: true,
      },
    });
  }

  async listProfessionals(
    organizationId: string,
    search?: string,
    status?: string,
  ) {
    const where: any = { organizationId };

    if (search?.trim()) {
      where.fullName = { contains: search.trim(), mode: 'insensitive' };
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const professionals = await this.prisma.professional.findMany({
      where,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        specialty: true,
        timezone: true,
        consultationMinutes: true,
        bufferMinutes: true,
        standardFee: true,
        isActive: true,
        createdAt: true,
        publicBookingEnabled: true,
        publicBookingSlug: true,
        depositAmount: true,
        depositWindowHours: true,
        paymentAlias: true,
        maxActiveBookings: true,
        waPublicBookingPhone: true,
        intakeEnabled: true,
        depositEnabled: true,
      },
    });

    // Enrich with stats
    const ids = professionals.map((p) => p.id);
    if (ids.length === 0) return [];

    const [appointmentCounts, patientCounts] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['professionalId'],
        where: { professionalId: { in: ids } },
        _count: { id: true },
      }),
      this.prisma.patient.groupBy({
        by: ['professionalId'],
        where: { professionalId: { in: ids }, deletedAt: null },
        _count: { id: true },
      }),
    ]);

    const appointmentMap = new Map(
      appointmentCounts.map((r) => [r.professionalId, r._count.id]),
    );
    const patientMap = new Map(
      patientCounts.map((r) => [r.professionalId, r._count.id]),
    );

    return professionals.map((p) => ({
      ...p,
      totalAppointments: appointmentMap.get(p.id) ?? 0,
      totalPatients: patientMap.get(p.id) ?? 0,
    }));
  }

  async createProfessional(
    organizationId: string,
    dto: CreateMemberProfessionalDto,
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { slug: true, timezone: true },
    });

    const slug = this.generateSlug(org.slug, dto.fullName);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const professional = await this.prisma.professional.create({
        data: {
          organizationId,
          slug,
          fullName: dto.fullName.trim(),
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          phone: dto.phone?.trim() || null,
          specialty: dto.specialty?.trim() || null,
          timezone: dto.timezone ?? org.timezone,
          consultationMinutes: dto.consultationMinutes ?? 30,
          bufferMinutes: dto.bufferMinutes ?? 10,
          standardFee: new Prisma.Decimal(dto.standardFee),
        },
        select: {
          id: true,
          slug: true,
          fullName: true,
          email: true,
          phone: true,
          specialty: true,
          timezone: true,
          consultationMinutes: true,
          bufferMinutes: true,
          standardFee: true,
          isActive: true,
          createdAt: true,
        },
      });

      return professional;
    } catch (error) {
      this.handleConflictError(error);
    }
  }

  async updateProfessional(
    organizationId: string,
    professionalId: string,
    dto: UpdateMemberProfessionalDto,
  ) {
    await this.getOwnedProfessional(organizationId, professionalId);

    try {
      return await this.prisma.professional.update({
        where: { id: professionalId },
        data: {
          ...(dto.fullName !== undefined
            ? { fullName: dto.fullName.trim() }
            : {}),
          ...(dto.phone !== undefined
            ? { phone: dto.phone?.trim() || null }
            : {}),
          ...(dto.specialty !== undefined
            ? { specialty: dto.specialty?.trim() || null }
            : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
          ...(dto.consultationMinutes !== undefined
            ? { consultationMinutes: dto.consultationMinutes }
            : {}),
          ...(dto.bufferMinutes !== undefined
            ? { bufferMinutes: dto.bufferMinutes }
            : {}),
          ...(dto.standardFee !== undefined
            ? { standardFee: new Prisma.Decimal(dto.standardFee) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.publicBookingEnabled !== undefined
            ? { publicBookingEnabled: dto.publicBookingEnabled }
            : {}),
          ...(dto.publicBookingSlug !== undefined
            ? { publicBookingSlug: dto.publicBookingSlug || null }
            : {}),
          ...(dto.depositAmount !== undefined
            ? {
                depositAmount:
                  dto.depositAmount !== null
                    ? new Prisma.Decimal(dto.depositAmount)
                    : null,
              }
            : {}),
          ...(dto.depositWindowHours !== undefined
            ? { depositWindowHours: dto.depositWindowHours }
            : {}),
          ...(dto.paymentAlias !== undefined
            ? { paymentAlias: dto.paymentAlias || null }
            : {}),
          ...(dto.maxActiveBookings !== undefined
            ? { maxActiveBookings: dto.maxActiveBookings }
            : {}),
          ...(dto.waPublicBookingPhone !== undefined
            ? { waPublicBookingPhone: dto.waPublicBookingPhone || null }
            : {}),
          ...(dto.intakeEnabled !== undefined
            ? { intakeEnabled: dto.intakeEnabled }
            : {}),
          ...(dto.depositEnabled !== undefined
            ? { depositEnabled: dto.depositEnabled }
            : {}),
        },
        select: {
          id: true,
          slug: true,
          fullName: true,
          email: true,
          phone: true,
          specialty: true,
          timezone: true,
          consultationMinutes: true,
          bufferMinutes: true,
          standardFee: true,
          isActive: true,
          updatedAt: true,
          publicBookingEnabled: true,
          publicBookingSlug: true,
          depositAmount: true,
          depositWindowHours: true,
          paymentAlias: true,
          maxActiveBookings: true,
          waPublicBookingPhone: true,
          intakeEnabled: true,
          depositEnabled: true,
        },
      });
    } catch (error) {
      this.handleConflictError(error);
    }
  }

  async deactivateProfessional(organizationId: string, professionalId: string) {
    await this.getOwnedProfessional(organizationId, professionalId);

    const current = await this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
      select: { isActive: true },
    });

    return this.prisma.professional.update({
      where: { id: professionalId },
      data: { isActive: !current.isActive },
      select: { id: true, isActive: true },
    });
  }

  async getOrgStats(organizationId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const [
      totalProfessionals,
      totalPatients,
      totalAppointments,
      appointmentsThisMonth,
      revenues,
    ] = await Promise.all([
      this.prisma.professional.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.patient.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.appointment.count({
        where: { organizationId },
      }),
      this.prisma.appointment.count({
        where: {
          organizationId,
          startAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.revenue.aggregate({
        where: {
          professional: { organizationId },
          occurredAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalProfessionals,
      totalPatients,
      totalAppointments,
      appointmentsThisMonth,
      revenueThisMonth: Number(revenues._sum.amount ?? 0),
    };
  }

  // ── Public booking settings ─────────────────────────────────────

  private readonly bookingSettingsSelect = {
    publicBookingEnabled: true,
    publicBookingSlug: true,
    depositAmount: true,
    depositWindowHours: true,
    maxActiveBookings: true,
    waPublicBookingPhone: true,
    intakeEnabled: true,
    depositEnabled: true,
  } as const;

  async getPublicBookingSettings(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: this.bookingSettingsSelect,
    });
  }

  async updatePublicBookingSettings(
    organizationId: string,
    dto: UpdatePublicBookingSettingsDto,
  ) {
    // Build data, handling null/undefined
    const data: Record<string, unknown> = {};
    if (dto.publicBookingEnabled !== undefined) {
      data.publicBookingEnabled = dto.publicBookingEnabled;
    }
    if (dto.publicBookingSlug !== undefined) {
      data.publicBookingSlug = dto.publicBookingSlug || null;
    }
    if (dto.depositAmount !== undefined) {
      data.depositAmount =
        dto.depositAmount !== null
          ? new Prisma.Decimal(dto.depositAmount)
          : null;
    }
    if (dto.depositWindowHours !== undefined) {
      data.depositWindowHours = dto.depositWindowHours;
    }
    if (dto.maxActiveBookings !== undefined) {
      data.maxActiveBookings = dto.maxActiveBookings;
    }
    if (dto.waPublicBookingPhone !== undefined) {
      data.waPublicBookingPhone = dto.waPublicBookingPhone || null;
    }
    if (dto.intakeEnabled !== undefined) {
      data.intakeEnabled = dto.intakeEnabled;
    }
    if (dto.depositEnabled !== undefined) {
      data.depositEnabled = dto.depositEnabled;
    }

    // R6: When org publicBookingEnabled toggles on and publicBookingSlug is null/omitted,
    // default to org slug
    if (dto.publicBookingEnabled === true && !data.publicBookingSlug) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true },
      });
      if (org) {
        data.publicBookingSlug = org.slug;
      }
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
      select: this.bookingSettingsSelect,
    });
  }

  private async getOwnedProfessional(
    organizationId: string,
    professionalId: string,
  ) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId },
    });
    if (!professional) {
      throw new NotFoundException('Profesional no encontrado');
    }
    return professional;
  }

  private generateSlug(orgSlug: string, fullName: string): string {
    const nameSlug = fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `${orgSlug}-${nameSlug}`;
  }

  private handleConflictError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes('publicBookingSlug')) {
        throw new ConflictException('El slug de turnos online ya está en uso');
      }
      throw new ConflictException('Ya existe un profesional con ese email');
    }
    throw error;
  }
}
