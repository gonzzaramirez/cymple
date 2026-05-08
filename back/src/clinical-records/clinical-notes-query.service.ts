import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessContext } from '../common/tenant/access-context';
import { ListClinicalRecordsDto } from './dto/list-clinical-records.dto';
import { ListNotesDto } from './dto/list-notes.dto';

@Injectable()
export class ClinicalNotesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPatient(
    ctx: AccessContext,
    patientId: string,
    query: ListClinicalRecordsDto,
  ) {
    await this.ensureOwnedPatient(ctx, patientId);
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ClinicalRecordWhereInput = {
      deletedAt: null,
      patientId,
      ...this.scopeFilter(ctx),
      ...(query.recordType ? { recordType: query.recordType } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.clinicalRecord.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { id: true, fullName: true, specialty: true } },
          appointment: { select: { id: true, status: true, startAt: true } },
        },
      }),
      this.prisma.clinicalRecord.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async listByAppointment(ctx: AccessContext, appointmentId: string) {
    await this.ensureOwnedAppointment(ctx, appointmentId);
    return this.prisma.clinicalRecord.findMany({
      where: {
        appointmentId,
        deletedAt: null,
        ...this.scopeFilter(ctx),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        professional: { select: { id: true, fullName: true, specialty: true } },
        appointment: { select: { id: true, status: true, startAt: true } },
      },
    });
  }

  async listNotes(ctx: AccessContext, query: ListNotesDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ClinicalRecordWhereInput = {
      deletedAt: null,
      ...this.scopeFilter(ctx),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.appointmentId ? { appointmentId: query.appointmentId } : {}),
      ...(query.recordType ? { recordType: query.recordType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.clinicalRecord.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { id: true, fullName: true, specialty: true } },
          patient: { select: { id: true, firstName: true, lastName: true } },
          appointment: { select: { id: true, status: true, startAt: true } },
        },
      }),
      this.prisma.clinicalRecord.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  private async ensureOwnedPatient(ctx: AccessContext, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        deletedAt: null,
        ...this.patientScopeFilter(ctx),
      },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
  }

  private async ensureOwnedAppointment(ctx: AccessContext, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...this.appointmentScopeFilter(ctx),
      },
      select: { id: true },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
  }

  private patientScopeFilter(ctx: AccessContext): Prisma.PatientWhereInput {
    if (ctx.role === 'CENTER_ADMIN') {
      return { organizationId: ctx.organizationId };
    }
    if (ctx.role === 'CENTER_MEMBER') {
      return {
        organizationId: ctx.organizationId,
        appointments: { some: { professionalId: ctx.professionalId } },
      };
    }
    return { professionalId: ctx.professionalId };
  }

  private appointmentScopeFilter(ctx: AccessContext): Prisma.AppointmentWhereInput {
    if (ctx.role === 'CENTER_ADMIN') {
      return { organizationId: ctx.organizationId };
    }
    return { professionalId: ctx.professionalId };
  }

  private scopeFilter(ctx: AccessContext): Prisma.ClinicalRecordWhereInput {
    if (ctx.role === 'CENTER_ADMIN') {
      return { organizationId: ctx.organizationId };
    }
    return { professionalId: ctx.professionalId };
  }
}
