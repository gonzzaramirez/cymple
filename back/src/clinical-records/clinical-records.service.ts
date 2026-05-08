import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NoteType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessContext } from '../common/tenant/access-context';
import { CreateGeneralNoteDto } from './dto/create-general-note.dto';
import { ListClinicalRecordsDto } from './dto/list-clinical-records.dto';
import { UpdateClinicalRecordDto } from './dto/update-clinical-record.dto';
import { UpsertAppointmentReasonDto } from './dto/upsert-appointment-reason.dto';

@Injectable()
export class ClinicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGeneralNote(
    ctx: AccessContext,
    patientId: string,
    dto: CreateGeneralNoteDto,
  ) {
    const patient = await this.getOwnedPatient(ctx, patientId);
    const professionalId = this.resolveProfessionalId(
      ctx,
      patient.professionalId ?? undefined,
    );
    return this.prisma.clinicalRecord.create({
      data: {
        patientId: patient.id,
        professionalId,
        organizationId: patient.organizationId ?? null,
        recordType: NoteType.GENERAL_NOTE,
        content: this.toInputJson(dto.content),
        plainTextPreview: this.buildPreview(dto.content, dto.plainTextPreview),
      },
      include: {
        professional: { select: { id: true, fullName: true, specialty: true } },
      },
    });
  }

  async listByPatient(
    ctx: AccessContext,
    patientId: string,
    query: ListClinicalRecordsDto,
  ) {
    await this.getOwnedPatient(ctx, patientId);
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

  async upsertAppointmentReason(
    ctx: AccessContext,
    appointmentId: string,
    dto: UpsertAppointmentReasonDto,
  ) {
    const appointment = await this.getOwnedAppointment(ctx, appointmentId);
    const professionalId = this.resolveProfessionalId(
      ctx,
      appointment.professionalId,
    );
    return this.prisma.clinicalRecord.upsert({
      where: {
        appointmentId_recordType: {
          appointmentId,
          recordType: NoteType.APPOINTMENT_REASON,
        },
      },
      create: {
        patientId: appointment.patientId,
        professionalId,
        organizationId: appointment.organizationId ?? null,
        appointmentId,
        recordType: NoteType.APPOINTMENT_REASON,
        content: this.toInputJson(dto.content),
        plainTextPreview: this.buildPreview(dto.content, dto.plainTextPreview),
      },
      update: {
        content: this.toInputJson(dto.content),
        plainTextPreview: this.buildPreview(dto.content, dto.plainTextPreview),
        deletedAt: null,
      },
      include: {
        professional: { select: { id: true, fullName: true, specialty: true } },
      },
    });
  }

  async update(
    ctx: AccessContext,
    clinicalRecordId: string,
    dto: UpdateClinicalRecordDto,
  ) {
    const record = await this.prisma.clinicalRecord.findFirst({
      where: {
        id: clinicalRecordId,
        deletedAt: null,
        ...this.scopeFilter(ctx),
      },
    });
    if (!record) {
      throw new NotFoundException('Registro clínico no encontrado');
    }
    if (
      ctx.role !== 'CENTER_ADMIN' &&
      record.professionalId !== ctx.professionalId
    ) {
      throw new ForbiddenException('No podés editar este registro');
    }

    return this.prisma.clinicalRecord.update({
      where: { id: clinicalRecordId },
      data: {
        ...(dto.content ? { content: this.toInputJson(dto.content) } : {}),
        ...(dto.content || dto.plainTextPreview !== undefined
          ? {
              plainTextPreview: this.buildPreview(
                dto.content ?? (record.content as Record<string, unknown>),
                dto.plainTextPreview,
              ),
            }
          : {}),
      },
      include: {
        professional: { select: { id: true, fullName: true, specialty: true } },
      },
    });
  }

  private async getOwnedPatient(ctx: AccessContext, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        deletedAt: null,
        ...this.patientScopeFilter(ctx),
      },
      select: { id: true, organizationId: true, professionalId: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return patient;
  }

  private async getOwnedAppointment(ctx: AccessContext, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...this.appointmentScopeFilter(ctx),
      },
      select: { id: true, patientId: true, organizationId: true, professionalId: true },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    return appointment;
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

  private scopeFilter(ctx: AccessContext): Prisma.ClinicalRecordWhereInput {
    if (ctx.role === 'CENTER_ADMIN') {
      return { organizationId: ctx.organizationId };
    }
    return { professionalId: ctx.professionalId };
  }

  private appointmentScopeFilter(ctx: AccessContext): Prisma.AppointmentWhereInput {
    if (ctx.role === 'CENTER_ADMIN') {
      return { organizationId: ctx.organizationId };
    }
    return { professionalId: ctx.professionalId };
  }

  private resolveProfessionalId(
    ctx: AccessContext,
    fallbackProfessionalId?: string | null,
  ) {
    const professionalId = ctx.professionalId ?? fallbackProfessionalId;
    if (!professionalId) {
      throw new BadRequestException(
        'No se pudo resolver el profesional para este registro',
      );
    }
    return professionalId;
  }

  private toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private buildPreview(
    content: Record<string, unknown>,
    fallback?: string,
  ): string {
    if (fallback?.trim()) {
      return fallback.trim().slice(0, 500);
    }
    const text = this.extractText(content).trim();
    return text.slice(0, 500);
  }

  private extractText(node: unknown): string {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) {
      return node.map((item) => this.extractText(item)).join(' ');
    }
    if (typeof node === 'object') {
      const record = node as Record<string, unknown>;
      const text = typeof record.text === 'string' ? record.text : '';
      const content = this.extractText(record.content);
      return `${text} ${content}`.trim();
    }
    return '';
  }
}
