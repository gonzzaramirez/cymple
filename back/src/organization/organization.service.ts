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

  async listProfessionals(organizationId: string) {
    const professionals = await this.prisma.professional.findMany({
      where: { organizationId },
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
      throw new ConflictException('Ya existe un profesional con ese email');
    }
    throw error;
  }
}
