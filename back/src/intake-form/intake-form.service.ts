import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SubmitIntakeDto } from './dto/submit-intake.dto';

export interface IntakeFormPayload {
  firstName: string;
  lastName: string;
  birthDate: string;
  age: number;
  lastTreatmentDate?: string;
  avoidAreas?: string;
  habits: {
    alcohol: boolean;
    cigarettes: boolean;
    drugs: boolean;
    coffee: boolean;
  };
  homeCare: {
    cleaning: boolean;
    exfoliation: boolean;
    moisturizers: boolean;
    hydratants: boolean;
    sunProtection: boolean;
    none: boolean;
  };
  visibleCapillaries: {
    nose: boolean;
    cheeks: boolean;
    forehead: boolean;
    erythema: boolean;
    irritation: boolean;
    cuperosity: boolean;
  };
  sebaceousCondition: {
    pustules: boolean;
    papules: boolean;
    hyperplasia: boolean;
    comedones: boolean;
    milium: boolean;
  };
  pigmentation: {
    hyperpigmentation: boolean;
    hypopigmentation: boolean;
  };
}

export interface IntakeStatusResponse {
  submitted: boolean;
  submittedAt?: string;
}

@Injectable()
export class IntakeFormService {
  private readonly logger = new Logger(IntakeFormService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Check if intake was already submitted for this token. */
  async getStatus(intakeToken: string): Promise<IntakeStatusResponse> {
    const booking = await this.prisma.publicBooking.findUnique({
      where: { intakeToken },
      select: { intakeCompleted: true, updatedAt: true },
    });

    if (!booking) {
      throw new NotFoundException('Token de ficha no encontrado');
    }

    return {
      submitted: booking.intakeCompleted,
      submittedAt: booking.intakeCompleted ? booking.updatedAt.toISOString() : undefined,
    };
  }

  /** Submit intake form data for a booking identified by its intake token. */
  async submit(intakeToken: string, dto: SubmitIntakeDto): Promise<{ success: boolean }> {
    const booking = await this.prisma.publicBooking.findUnique({
      where: { intakeToken },
      include: {
        professional: { select: { id: true, organizationId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Token de ficha no encontrado');
    }

    if (booking.intakeCompleted) {
      throw new ConflictException('Esta ficha de ingreso ya fue completada anteriormente');
    }

    // Calculate age from birthDate
    const birth = new Date(dto.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    // Build the structured content
    const payload: IntakeFormPayload = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      birthDate: dto.birthDate,
      age,
      lastTreatmentDate: dto.lastTreatmentDate,
      avoidAreas: dto.avoidAreas,
      habits: {
        alcohol: dto.habits.alcohol ?? false,
        cigarettes: dto.habits.cigarettes ?? false,
        drugs: dto.habits.drugs ?? false,
        coffee: dto.habits.coffee ?? false,
      },
      homeCare: {
        cleaning: dto.homeCare.cleaning ?? false,
        exfoliation: dto.homeCare.exfoliation ?? false,
        moisturizers: dto.homeCare.moisturizers ?? false,
        hydratants: dto.homeCare.hydratants ?? false,
        sunProtection: dto.homeCare.sunProtection ?? false,
        none: dto.homeCare.none ?? false,
      },
      visibleCapillaries: {
        nose: dto.visibleCapillaries.nose ?? false,
        cheeks: dto.visibleCapillaries.cheeks ?? false,
        forehead: dto.visibleCapillaries.forehead ?? false,
        erythema: dto.visibleCapillaries.erythema ?? false,
        irritation: dto.visibleCapillaries.irritation ?? false,
        cuperosity: dto.visibleCapillaries.cuperosity ?? false,
      },
      sebaceousCondition: {
        pustules: dto.sebaceousCondition.pustules ?? false,
        papules: dto.sebaceousCondition.papules ?? false,
        hyperplasia: dto.sebaceousCondition.hyperplasia ?? false,
        comedones: dto.sebaceousCondition.comedones ?? false,
        milium: dto.sebaceousCondition.milium ?? false,
      },
      pigmentation: {
        hyperpigmentation: dto.pigmentation.hyperpigmentation ?? false,
        hypopigmentation: dto.pigmentation.hypopigmentation ?? false,
      },
    };

    // If the patient doesn't exist yet (shouldn't happen by this point), create one
    let patientId = booking.patientId;
    if (!patientId) {
      const patient = await this.prisma.patient.create({
        data: {
          professionalId: booking.professionalId,
          organizationId: booking.professional.organizationId ?? null,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: booking.patientPhone,
          birthDate: new Date(dto.birthDate),
        },
      });
      patientId = patient.id;

      // Link the new patient to the booking
      await this.prisma.publicBooking.update({
        where: { id: booking.id },
        data: { patientId },
      });
    } else {
      // Update existing patient with intake data
      await this.prisma.patient.update({
        where: { id: patientId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          birthDate: new Date(dto.birthDate),
        },
      });
    }

    // Save the ClinicalRecord with INTAKE_FORM type
    await this.prisma.clinicalRecord.create({
      data: {
        patientId,
        professionalId: booking.professionalId,
        organizationId: booking.professional.organizationId ?? null,
        recordType: 'INTAKE_FORM',
        title: `Ficha de ingreso - ${dto.firstName} ${dto.lastName}`,
        content: payload as unknown as Prisma.InputJsonValue,
        plainTextPreview: `Ficha de ingreso: ${dto.firstName} ${dto.lastName}, ${age} años`,
      },
    });

    // Mark intake as completed
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: { intakeCompleted: true },
    });

    return { success: true };
  }
}
