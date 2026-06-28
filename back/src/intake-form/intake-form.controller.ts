import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { IntakeFormService } from './intake-form.service';
import { SubmitIntakeDto } from './dto/submit-intake.dto';

// ── Public Controller (no auth) ───────────────────────────────────

@Controller('public/intake')
export class PublicIntakeController {
  constructor(private readonly intakeFormService: IntakeFormService) {}

  @Get(':intakeToken')
  async getStatus(@Param('intakeToken') intakeToken: string) {
    return this.intakeFormService.getStatus(intakeToken);
  }

  @Post(':intakeToken')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async submit(
    @Param('intakeToken') intakeToken: string,
    @Body() dto: SubmitIntakeDto,
  ) {
    return this.intakeFormService.submit(intakeToken, dto);
  }
}

// ── Dashboard Controller (auth required) ──────────────────────────

@Controller('bookings/:id/intake')
@UseGuards(JwtAuthGuard, TenantGuard)
export class IntakeDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeFormService: IntakeFormService,
  ) {}

  @Get()
  async getIntake(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') bookingId: string,
  ) {
    const booking = await this.prisma.publicBooking.findFirst({
      where: { id: bookingId, professionalId },
      select: { patientId: true, patientPhone: true, intakeCompleted: true },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    // If this specific booking has intake completed, use its patientId
    let patientId = booking.intakeCompleted ? booking.patientId : null;

    // If not, check if ANY booking with the same phone has completed intake
    if (!patientId && booking.patientPhone) {
      const completed = await this.prisma.publicBooking.findFirst({
        where: {
          professionalId,
          patientPhone: booking.patientPhone,
          intakeCompleted: true,
          patientId: { not: null },
        },
        select: { patientId: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (completed) {
        patientId = completed.patientId;
      }
    }

    if (!patientId) {
      return { intakeCompleted: false, data: null };
    }

    const record = await this.prisma.clinicalRecord.findFirst({
      where: {
        patientId,
        professionalId,
        recordType: 'INTAKE_FORM',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { content: true, createdAt: true },
    });

    return {
      intakeCompleted: true,
      data: record?.content ?? null,
      submittedAt: record?.createdAt?.toISOString() ?? null,
    };
  }
}
