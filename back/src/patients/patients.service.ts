import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(professionalId: string, dto: CreatePatientDto) {
    try {
      return await this.prisma.patient.create({
        data: {
          professionalId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim().toLowerCase(),
          dni: dto.dni?.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          notes: dto.notes?.trim(),
        },
      });
    } catch (error) {
      this.handlePatientConstraintError(error);
    }
  }

  async list(professionalId: string, query: SearchPatientsDto) {
    const skip = (query.page - 1) * query.limit;
    const term = query.query?.trim();
    const where: Prisma.PatientWhereInput = {
      professionalId,
      deletedAt: null,
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async getOne(professionalId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        professionalId,
        deletedAt: null,
      },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    return patient;
  }

  async update(
    professionalId: string,
    patientId: string,
    dto: UpdatePatientDto,
  ) {
    await this.getOne(professionalId, patientId);

    try {
      return await this.prisma.patient.update({
        where: { id: patientId },
        data: {
          ...dto,
          email: dto.email?.trim().toLowerCase(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        },
      });
    } catch (error) {
      this.handlePatientConstraintError(error);
    }
  }

  async remove(professionalId: string, patientId: string) {
    await this.getOne(professionalId, patientId);

    const now = new Date();
    const futureAppointments = await this.prisma.appointment.count({
      where: {
        professionalId,
        patientId,
        startAt: { gt: now },
        status: { not: AppointmentStatus.CANCELLED },
      },
    });

    if (futureAppointments > 0) {
      throw new BadRequestException(
        'No se puede eliminar el paciente porque tiene turnos futuros',
      );
    }

    return this.prisma.patient.update({
      where: { id: patientId },
      data: { deletedAt: now },
    });
  }

  async history(professionalId: string, patientId: string) {
    const patient = await this.getOne(professionalId, patientId);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        patientId,
      },
      orderBy: { startAt: 'desc' },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        fee: true,
      },
    });

    const totals = appointments.reduce(
      (acc, item) => {
        if (item.status === AppointmentStatus.ATTENDED) {
          acc.totalSessions += 1;
          acc.totalBilled += Number(item.fee);
        }
        return acc;
      },
      { totalSessions: 0, totalBilled: 0 },
    );

    const messages = await this.prisma.messageLog.findMany({
      where: { professionalId, patientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
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
      },
    });

    return {
      patient,
      appointments,
      summary: totals,
      messages,
    };
  }

  private handlePatientConstraintError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Teléfono o DNI ya existe para este profesional',
      );
    }
    throw error;
  }
}
