import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentStatus,
  BookingStatus,
  DepositStatus,
  MessageType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import { normalizeArWhatsappNumber } from '../common/utils/phone.utils';
import { addMinutes } from '../common/utils/date.utils';
import { generateBookingToken, extractBookingToken } from './booking-token.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';

// ── Response types ────────────────────────────────────────────────

export interface ProfessionalPublicInfo {
  id: string;
  fullName: string;
  specialty: string | null;
  depositAmount: Prisma.Decimal | null;
  depositWindowHours: number;
  consultationMinutes: number;
  standardFee: Prisma.Decimal;
  paymentAlias: string | null;
}

export interface SlotInfo {
  startAt: string;
  endAt: string;
  bookedCount: number;
  remainingCapacity: number | null;
  hasCapacityLimit: boolean;
}

export interface CreateBookingResult {
  token: string;
  waDeepLink: string;
  expiresAt: Date;
}

export interface BookingStatusResponse {
  status: string;
  depositStatus: string;
  depositAmount: string | null;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
}

export interface PaginatedBookings {
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookingDetail {
  id: string;
  token: string;
  status: string;
  depositStatus: string;
  depositAmount: string | null;
  depositPaidAt: Date | null;
  slotDate: Date;
  slotStart: string;
  slotEnd: string;
  patientName: string;
  patientPhone: string;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  expiresAt: Date;
  waContactedAt: Date | null;
  intakeCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  professionalId: string;
  professionalName: string;
  professionalSlug: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  appointment: {
    id: string;
    startAt: Date;
    endAt: Date;
    status: string;
  } | null;
}

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class PublicBookingService {
  private readonly logger = new Logger(PublicBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly evolution: EvolutionApiService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly messageTemplates: MessageTemplatesService,
  ) {}

  // ── Public methods ────────────────────────────────────────────────

  async getProfessionalBySlug(
    slug: string,
  ): Promise<ProfessionalPublicInfo | null> {
    const professional = await this.prisma.professional.findFirst({
      where: {
        publicBookingSlug: slug,
        publicBookingEnabled: true,
      },
      select: {
        id: true,
        fullName: true,
        specialty: true,
        depositAmount: true,
        depositWindowHours: true,
        phone: true,
        consultationMinutes: true,
        standardFee: true,
        paymentAlias: true,
      },
    });

    if (!professional) return null;
    return {
      id: professional.id,
      fullName: professional.fullName,
      specialty: professional.specialty,
      depositAmount: professional.depositAmount,
      depositWindowHours: professional.depositWindowHours,
      consultationMinutes: professional.consultationMinutes,
      standardFee: professional.standardFee,
      paymentAlias: professional.paymentAlias,
    };
  }

  async getSlots(
    slug: string,
    date: string,
  ): Promise<{ date: string; slots: SlotInfo[] }> {
    const professional = await this.prisma.professional.findFirst({
      where: { publicBookingSlug: slug, publicBookingEnabled: true },
      select: { id: true },
    });

    if (!professional) {
      throw new NotFoundException(
        'Profesional no encontrado o reserva pública no habilitada',
      );
    }

    return this.availability.getSlots(professional.id, date);
  }

  /**
   * Returns which dates in the [from, to] range have at least one available
   * slot. Replaces the N+1 "fetch every day" pattern in the public calendar.
   */
  async getAvailability(
    slug: string,
    from: string,
    to: string,
  ): Promise<{ dates: string[]; from: string; to: string }> {
    const professional = await this.prisma.professional.findFirst({
      where: { publicBookingSlug: slug, publicBookingEnabled: true },
      select: { id: true, consultationMinutes: true, bufferMinutes: true },
    });

    if (!professional) {
      throw new NotFoundException(
        'Profesional no encontrado o reserva pública no habilitada',
      );
    }

    const fromDate = new Date(`${from}T00:00:00.000-03:00`);
    const toDate = new Date(`${to}T23:59:59.999-03:00`);

    // 1. Find specific-date overrides and weekly ranges in the window.
    const [specificDates, weeklyRanges] = await Promise.all([
      this.prisma.specificDateAvailability.findMany({
        where: {
          professionalId: professional.id,
          date: { gte: fromDate, lte: toDate },
        },
        include: { ranges: true, slotCapacities: true },
      }),
      this.prisma.weeklyAvailability.findMany({
        where: { professionalId: professional.id, isEnabled: true },
        include: { ranges: true },
      }),
    ]);

    // Helper: format a Date (representing a calendar day) as YYYY-MM-DD
    // in the *AR* timezone, so we never miss or duplicate days around the
    // midnight boundary.
    const formatDay = (d: Date): string => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const y = parts.find((p) => p.type === 'year')!.value;
      const m = parts.find((p) => p.type === 'month')!.value;
      const day = parts.find((p) => p.type === 'day')!.value;
      return `${y}-${m}-${day}`;
    };

    // 2. For each date in [from, to], decide if it has any slot.
    const dates: string[] = [];
    const cursor = new Date(fromDate);
    const endCursor = new Date(toDate);
    const slotMs =
      (professional.consultationMinutes + professional.bufferMinutes) * 60000;

    while (cursor.getTime() <= endCursor.getTime()) {
      // Skip past dates (compared in AR local time so we don't miss "today").
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (cursor < today) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const dateStr = formatDay(cursor);
      const specific = specificDates.find((s) => formatDay(s.date) === dateStr);

      let totalRangeMs = 0;
      if (specific) {
        if (specific.isEnabled) {
          totalRangeMs = specific.ranges.reduce((acc, r) => {
            const [sh, sm] = r.startTime.split(':').map(Number);
            const [eh, em] = r.endTime.split(':').map(Number);
            return acc + (eh * 60 + em - (sh * 60 + sm)) * 60000;
          }, 0);
        }
        // specific.isEnabled === false → no availability
      } else {
        // weekday must be derived from the calendar day, not the raw Date
        // (which is in UTC and could be off by one).
        const weekday = this.dateToWeekdayAr(cursor);
        const weekly = weeklyRanges.find((w) => w.weekday === weekday);
        if (weekly) {
          totalRangeMs = weekly.ranges.reduce((acc, r) => {
            const [sh, sm] = r.startTime.split(':').map(Number);
            const [eh, em] = r.endTime.split(':').map(Number);
            return acc + (eh * 60 + em - (sh * 60 + sm)) * 60000;
          }, 0);
        }
      }

      const possibleSlots = totalRangeMs / slotMs;
      if (possibleSlots > 0) {
        dates.push(dateStr);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return { dates, from, to };
  }

  /** Weekday name in AR local time (avoids off-by-one at UTC midnight). */
  private dateToWeekdayAr(
    date: Date,
  ):
    | 'MONDAY'
    | 'TUESDAY'
    | 'WEDNESDAY'
    | 'THURSDAY'
    | 'FRIDAY'
    | 'SATURDAY'
    | 'SUNDAY' {
    const dayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(date);
    const map: Record<
      string,
      | 'MONDAY'
      | 'TUESDAY'
      | 'WEDNESDAY'
      | 'THURSDAY'
      | 'FRIDAY'
      | 'SATURDAY'
      | 'SUNDAY'
    > = {
      Monday: 'MONDAY',
      Tuesday: 'TUESDAY',
      Wednesday: 'WEDNESDAY',
      Thursday: 'THURSDAY',
      Friday: 'FRIDAY',
      Saturday: 'SATURDAY',
      Sunday: 'SUNDAY',
    };
    return map[dayName];
  }

  /** Format a YYYY-MM-DD date to Spanish day + month name (AR timezone safe). */
  private formatSlotDateSpanish(dateStr: string): [dayName: string, monthName: string] {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    const day = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(dt);
    const month = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(dt);
    return [day, month];
  }

  async createBooking(dto: CreateBookingDto): Promise<CreateBookingResult> {
    // 1. Find professional by slug
    const professional = await this.prisma.professional.findFirst({
      where: {
        publicBookingSlug: dto.professionalSlug,
        publicBookingEnabled: true,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        waPublicBookingPhone: true,
        depositAmount: true,
        depositWindowHours: true,
        maxActiveBookings: true,
        consultationMinutes: true,
        timezone: true,
      },
    });

    if (!professional) {
      throw new NotFoundException(
        'Profesional no encontrado o reserva pública no habilitada',
      );
    }

    // 2. Check slot availability
    const slotsData = await this.availability.getSlots(
      professional.id,
      dto.slotDate,
    );
    const requestedSlotStart = new Date(
      dto.slotDate + 'T' + dto.slotStart + ':00.000-03:00',
    ).toISOString();

    const slotAvailable = slotsData.slots.some(
      (s) =>
        s.startAt === requestedSlotStart &&
        s.endAt ===
          new Date(
            dto.slotDate + 'T' + dto.slotEnd + ':00.000-03:00',
          ).toISOString(),
    );

    if (!slotAvailable) {
      throw new BadRequestException(
        'El horario seleccionado no está disponible',
      );
    }

    // Check remaining capacity
    const matchingSlot = slotsData.slots.find(
      (s) => s.startAt === requestedSlotStart,
    );
    if (
      matchingSlot &&
      matchingSlot.remainingCapacity !== null &&
      matchingSlot.remainingCapacity <= 0
    ) {
      throw new BadRequestException(
        'No hay cupos disponibles para este horario',
      );
    }

    // 3. Check max active bookings
    if (professional.maxActiveBookings > 0) {
      const phoneNorm = normalizeArWhatsappNumber(dto.patientPhone);
      const existingCount = await this.prisma.publicBooking.count({
        where: {
          professionalId: professional.id,
          patientPhone: phoneNorm,
          status: {
            in: [
              BookingStatus.PENDING_WA_CONFIRMATION,
              BookingStatus.WA_CONTACTED,
              BookingStatus.BOOKED,
              BookingStatus.INTAKE_SENT,
              BookingStatus.INTAKE_COMPLETED,
            ],
          },
        },
      });

      if (existingCount >= professional.maxActiveBookings) {
        throw new BadRequestException(
          `Ya tenés ${existingCount} reserva(s) activa(s) con este profesional. El máximo permitido es ${professional.maxActiveBookings}.`,
        );
      }
    }

    // 4. Generate sequential booking token (R-001, R-002…)
    const token = await generateBookingToken(this.prisma, professional.id);

    // 5. Generate intake token
    const intakeToken = crypto.randomUUID();

    // 6. Build dates — noon UTC avoids timezone off-by-one (AR midnight = 03 UTC, noon won't shift day)
    const slotDateObj = new Date(`${dto.slotDate}T12:00:00.000Z`);
    const expiresAt = addMinutes(new Date(), 30);

    // 7. Build WA deep link
    const professionalPhone = normalizeArWhatsappNumber(
      professional.waPublicBookingPhone ?? professional.phone ?? '',
    );
    const [dayName, monthName] = this.formatSlotDateSpanish(dto.slotDate);
    const waMessage =
      `Hola!%20Quiero%20reservar%20un%20turno%20para%20el%20${dayName}%20${dto.slotDate}%20a%20las%20${dto.slotStart}.%20Mi%20codigo%20es%20${token}.%20Muchas%20gracias!`;
    const waDeepLink = `https://wa.me/${professionalPhone}?text=${waMessage}`;

    // 8. Create PublicBooking
    const booking = await this.prisma.publicBooking.create({
      data: {
        professionalId: professional.id,
        slotDate: slotDateObj,
        slotStart: dto.slotStart,
        slotEnd: dto.slotEnd,
        patientName: dto.patientName,
        patientPhone: normalizeArWhatsappNumber(dto.patientPhone),
        token,
        intakeToken,
        status: BookingStatus.PENDING_WA_CONFIRMATION,
        depositStatus: DepositStatus.PENDING,
        depositAmount: professional.depositAmount,
        expiresAt,
      },
    });

    return {
      token: booking.token,
      waDeepLink,
      expiresAt: booking.expiresAt,
    };
  }

  async getBookingStatus(token: string): Promise<BookingStatusResponse | null> {
    const booking = await this.prisma.publicBooking.findUnique({
      where: { token },
      select: {
        status: true,
        depositStatus: true,
        depositAmount: true,
        slotDate: true,
        slotStart: true,
        slotEnd: true,
      },
    });

    if (!booking) return null;

    return {
      status: booking.status,
      depositStatus: booking.depositStatus,
      depositAmount: booking.depositAmount?.toString() ?? null,
      slotDate: booking.slotDate.toISOString(),
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
    };
  }

  async checkIntakeStatus(
    slug: string,
    phone: string,
  ): Promise<{ hasCompletedIntake: boolean; patientId?: string }> {
    const professional = await this.prisma.professional.findFirst({
      where: { publicBookingSlug: slug, publicBookingEnabled: true },
      select: { id: true },
    });

    if (!professional) {
      throw new NotFoundException(
        'Profesional no encontrado o reserva pública no habilitada',
      );
    }

    const phoneNorm = normalizeArWhatsappNumber(phone);
    const patient = await this.prisma.patient.findFirst({
      where: {
        professionalId: professional.id,
        phone: phoneNorm,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!patient) {
      return { hasCompletedIntake: false };
    }

    // Check if the patient has completed intake (any booking with intakeCompleted)
    const intakeBooking = await this.prisma.publicBooking.findFirst({
      where: {
        patientId: patient.id,
        professionalId: professional.id,
        intakeCompleted: true,
      },
      select: { id: true },
    });

    return {
      hasCompletedIntake: intakeBooking !== null,
      patientId: patient.id,
    };
  }

  // ── Webhook handler (called from WebhooksService) ────────────────

  async handleBookingConfirm(
    token: string,
    waMessageId: string,
  ): Promise<void> {
    const booking = await this.prisma.publicBooking.findUnique({
      where: { token },
      include: {
        professional: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            consultationMinutes: true,
            bufferMinutes: true,
            standardFee: true,
            depositAmount: true,
            depositWindowHours: true,
            timezone: true,
            paymentAlias: true,
            organizationId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Token de reserva no encontrado');
    }

    // Idempotency: if already booked or beyond, skip
    if (
      booking.status === BookingStatus.BOOKED ||
      booking.status === BookingStatus.INTAKE_SENT ||
      booking.status === BookingStatus.INTAKE_COMPLETED
    ) {
      return;
    }

    // Check expiry
    if (
      booking.expiresAt < new Date() &&
      booking.status === BookingStatus.PENDING_WA_CONFIRMATION
    ) {
      await this.prisma.publicBooking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
      });
      throw new GoneException('El token de reserva expiró');
    }

    // Update status to WA_CONTACTED
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.WA_CONTACTED,
        waContactedAt: new Date(),
        waMessageId,
      },
    });

    // Find or create Patient (track if new)
    const phoneNorm = booking.patientPhone;
    const nameParts = booking.patientName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    let isNewPatient = false;

    let patient = await this.prisma.patient.findFirst({
      where: {
        professionalId: booking.professionalId,
        phone: phoneNorm,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!patient) {
      isNewPatient = true;
      patient = await this.prisma.patient.create({
        data: {
          professionalId: booking.professionalId,
          organizationId: booking.professional.organizationId ?? null,
          firstName,
          lastName,
          phone: phoneNorm,
        },
        select: { id: true, firstName: true, lastName: true },
      });
    } else {
      // Update name if needed
      if (patient.firstName !== firstName || patient.lastName !== lastName) {
        await this.prisma.patient.update({
          where: { id: patient.id },
          data: { firstName, lastName },
        });
      }
    }

    // Link patient to booking
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: { patientId: patient.id },
    });

    // Create Appointment (direct Prisma create, NOT via AppointmentsService)
    const startAt = new Date(booking.slotDate);
    const [startHour, startMin] = booking.slotStart.split(':').map(Number);
    startAt.setUTCHours(startHour + 3, startMin, 0, 0); // ARG TZ offset

    const durationMs = booking.professional.consultationMinutes * 60000;
    const endAt = new Date(startAt.getTime() + durationMs);

    const appointment = await this.prisma.appointment.create({
      data: {
        professionalId: booking.professionalId,
        organizationId: booking.professional.organizationId ?? null,
        patientId: patient.id,
        startAt,
        endAt,
        durationMinutes: booking.professional.consultationMinutes,
        bufferMinutes: booking.professional.bufferMinutes,
        fee: booking.professional.standardFee,
        status: AppointmentStatus.PENDING,
      },
    });

    // Link appointment to booking
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: {
        appointmentId: appointment.id,
        status: BookingStatus.BOOKED,
        expiresAt: addMinutes(
          new Date(),
          booking.professional.depositWindowHours,
        ),
      },
    });

    const slotDateHuman = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: booking.professional.timezone,
    }).format(booking.slotDate);

    // Send WA confirmation using template (with intake link for new patients)
    if (this.evolution.isConfigured()) {
      const depositAmount = Number(booking.professional.depositAmount ?? 0);
      const detalleSena =
        depositAmount > 0
          ? `💰 Seña: $${depositAmount.toLocaleString('es-AR')} — Alias: ${booking.professional.paymentAlias ?? '—'}\n` +
            `⏳ Tenés ${booking.professional.depositWindowHours}hs para enviar el comprobante.\n`
          : '';

      const appUrl = this.config.get<string>('APP_PUBLIC_URL') ?? '';
      const detalleFicha =
        isNewPatient && booking.intakeToken && appUrl
          ? `📋 Completá tu ficha de ingreso (solo una vez):\n${appUrl}/ficha/${booking.intakeToken}\n\n`
          : '';

      const tpl = await this.messageTemplates.getOne(
        booking.professionalId,
        MessageType.BOOKING_CONFIRMED,
        booking.professional.organizationId ?? undefined,
      );

      if (tpl.isEnabled) {
        const confirmationText = this.interpolate(tpl.body, {
          nombrePaciente: patient.firstName,
          fechaHumana: slotDateHuman,
          horario: booking.slotStart,
          nombreProfesional: booking.professional.fullName,
          detalleSena,
          detalleFicha,
          codigoReserva: booking.token,
        });

        const waCtx = await this.resolveWaInstance(booking.professional.id);
        if (waCtx) {
          await this.evolution.sendText(waCtx, phoneNorm, confirmationText);
        }
      }
    }

    // In-app notification
      void this.notifications
        .create({
          professionalId: booking.professionalId,
          organizationId: booking.professional.organizationId ?? undefined,
          type: 'NEW_BOOKING',
          title: `Nuevo turno online: ${patient.firstName} ${patient.lastName}`,
          body: `${slotDateHuman} a las ${booking.slotStart}hs`,
          link: `/bookings?id=${booking.id}`,
          patientId: patient.id,
          appointmentId: appointment.id,
          metadata: {
            patientName: `${patient.firstName} ${patient.lastName}`,
            bookingToken: booking.token,
          },
        });
  }

  async manualConfirm(
    professionalId: string,
    bookingId: string,
  ): Promise<void> {
    const booking = await this.prisma.publicBooking.findFirst({
      where: { id: bookingId, professionalId },
      include: {
        professional: {
          select: {
            fullName: true,
            phone: true,
            consultationMinutes: true,
            bufferMinutes: true,
            standardFee: true,
            depositAmount: true,
            depositWindowHours: true,
            timezone: true,
            paymentAlias: true,
            organizationId: true,
            reminderHours: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (booking.status !== BookingStatus.PENDING_WA_CONFIRMATION) {
      throw new BadRequestException(
        'Solo se pueden confirmar manualmente reservas en espera de WhatsApp',
      );
    }

    if (booking.expiresAt < new Date()) {
      await this.prisma.publicBooking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
      });
      throw new GoneException('La reserva expiró');
    }

    // Update status to WA_CONTACTED (skip WA message — manual override)
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.WA_CONTACTED,
        waContactedAt: new Date(),
      },
    });

    // Find or create Patient
    const phoneNorm = booking.patientPhone;
    const nameParts = booking.patientName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    let isNewPatient = false;

    let patient = await this.prisma.patient.findFirst({
      where: {
        professionalId: booking.professionalId,
        phone: phoneNorm,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!patient) {
      isNewPatient = true;
      patient = await this.prisma.patient.create({
        data: {
          professionalId: booking.professionalId,
          organizationId: booking.professional.organizationId ?? null,
          firstName,
          lastName,
          phone: phoneNorm,
        },
        select: { id: true, firstName: true, lastName: true },
      });
    } else {
      if (patient.firstName !== firstName || patient.lastName !== lastName) {
        await this.prisma.patient.update({
          where: { id: patient.id },
          data: { firstName, lastName },
        });
      }
    }

    // Link patient to booking
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: { patientId: patient.id },
    });

    // Create Appointment
    const startAt = new Date(booking.slotDate);
    const [startHour, startMin] = booking.slotStart.split(':').map(Number);
    startAt.setUTCHours(startHour + 3, startMin, 0, 0);

    const durationMs = booking.professional.consultationMinutes * 60000;
    const endAt = new Date(startAt.getTime() + durationMs);

    const appointment = await this.prisma.appointment.create({
      data: {
        professionalId: booking.professionalId,
        organizationId: booking.professional.organizationId ?? null,
        patientId: patient.id,
        startAt,
        endAt,
        durationMinutes: booking.professional.consultationMinutes,
        bufferMinutes: booking.professional.bufferMinutes,
        fee: booking.professional.standardFee,
        status: AppointmentStatus.CONFIRMED,
        reminderScheduledFor: addMinutes(
          startAt,
          -booking.professional.reminderHours * 60,
        ),
      },
    });

    // Link appointment and move to BOOKED
    await this.prisma.publicBooking.update({
      where: { id: booking.id },
      data: {
        appointmentId: appointment.id,
        status: BookingStatus.BOOKED,
        expiresAt: addMinutes(
          new Date(),
          booking.professional.depositWindowHours,
        ),
      },
    });

    // In-app notification
    void this.notifications
      .create({
        professionalId: booking.professionalId,
        organizationId: booking.professional.organizationId ?? undefined,
        type: 'NEW_BOOKING',
        title: `Nuevo turno online: ${patient.firstName} ${patient.lastName}`,
        body: `${booking.slotDate.toISOString().slice(0, 10)} a las ${booking.slotStart}hs`,
        link: `/bookings?id=${booking.id}`,
        patientId: patient.id,
        appointmentId: appointment.id,
        metadata: {
          patientName: `${patient.firstName} ${patient.lastName}`,
          bookingToken: booking.token,
        },
      });
  }

  // ── Dashboard methods ──────────────────────────────────────────────

  async listBookings(
    professionalId: string,
    query: BookingQueryDto,
  ): Promise<PaginatedBookings> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PublicBookingWhereInput = {
      professionalId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.month && query.year
        ? {
            slotDate: {
              gte: new Date(Date.UTC(query.year, query.month - 1, 1)),
              lte: new Date(
                Date.UTC(query.year, query.month, 0, 23, 59, 59, 999),
              ),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.publicBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          appointment: {
            select: { id: true, startAt: true, endAt: true, status: true },
          },
        },
      }),
      this.prisma.publicBooking.count({ where }),
    ]);

    // Normalize intakeCompleted: if a booking has no intake but another booking
    // with the same phone does, inherit it (patient submitted intake once)
    const phoneMap = new Map<string, boolean>();
    for (const item of items) {
      if (item.intakeCompleted && item.patientPhone) {
        phoneMap.set(item.patientPhone, true);
      }
    }
    if (phoneMap.size > 0) {
      // Find more phones that have intake completed (across all bookings)
      const pendingPhones = items
        .filter((i) => !i.intakeCompleted && i.patientPhone && !phoneMap.has(i.patientPhone))
        .map((i) => i.patientPhone)
        .filter((p): p is string => !!p);
      if (pendingPhones.length > 0) {
        const completedPhones = await this.prisma.publicBooking.findMany({
          where: {
            patientPhone: { in: pendingPhones },
            intakeCompleted: true,
          },
          select: { patientPhone: true },
          distinct: ['patientPhone'],
        });
        for (const cp of completedPhones) {
          phoneMap.set(cp.patientPhone, true);
        }
      }
      for (const item of items) {
        if (!item.intakeCompleted && item.patientPhone && phoneMap.has(item.patientPhone)) {
          (item as Record<string, unknown>).intakeCompleted = true;
        }
      }
    }

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getBookingDetail(
    professionalId: string,
    bookingId: string,
  ): Promise<BookingDetail | null> {
    const booking = await this.prisma.publicBooking.findFirst({
      where: {
        id: bookingId,
        professionalId,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        appointment: {
          select: { id: true, startAt: true, endAt: true, status: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    const professional = await this.prisma.professional.findUnique({
      where: { id: booking.professionalId },
      select: { id: true, fullName: true, slug: true, publicBookingSlug: true },
    });

    return {
      id: booking.id,
      token: booking.token,
      status: booking.status,
      depositStatus: booking.depositStatus,
      depositAmount: booking.depositAmount?.toString() ?? null,
      depositPaidAt: booking.depositPaidAt,
      slotDate: booking.slotDate,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      patientName: booking.patientName,
      patientPhone: booking.patientPhone,
      notes: booking.notes,
      cancelReason: booking.cancelReason,
      cancelledAt: booking.cancelledAt,
      expiresAt: booking.expiresAt,
      waContactedAt: booking.waContactedAt,
      intakeCompleted: await this.resolveIntakeCompleted(professionalId, booking),
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      patient: booking.patient
        ? {
            id: booking.patient.id,
            firstName: booking.patient.firstName,
            lastName: booking.patient.lastName,
            phone: booking.patient.phone,
          }
        : null,
      appointment: booking.appointment
        ? {
            id: booking.appointment.id,
            startAt: booking.appointment.startAt,
            endAt: booking.appointment.endAt,
            status: booking.appointment.status,
          }
        : null,
      professionalId: professional?.id ?? booking.professionalId,
      professionalName: professional?.fullName ?? '',
      professionalSlug:
        professional?.publicBookingSlug ?? professional?.slug ?? '',
    };
  }

  async markDepositPaid(
    professionalId: string,
    bookingId: string,
  ): Promise<void> {
    const booking = await this.prisma.publicBooking.findFirst({
      where: { id: bookingId, professionalId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: {
        depositStatus: DepositStatus.PAID,
        depositPaidAt: new Date(),
        depositPaidBy: 'MANUAL',
      },
    });
  }

  async cancelBooking(
    professionalId: string,
    bookingId: string,
    reason?: string,
  ): Promise<void> {
    const booking = await this.prisma.publicBooking.findFirst({
      where: { id: bookingId, professionalId },
      include: { appointment: true },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
      } as Prisma.PublicBookingUpdateInput,
    });

    // Cancel linked Appointment if it exists and is not already cancelled
    if (
      booking.appointment &&
      booking.appointment.status !== AppointmentStatus.CANCELLED
    ) {
      await this.prisma.appointment.update({
        where: { id: booking.appointmentId! },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          reason: reason ?? 'Cancelado por reserva pública',
        },
      });
    }
  }

  async updateNotes(
    professionalId: string,
    bookingId: string,
    notes: string,
  ): Promise<void> {
    const booking = await this.prisma.publicBooking.findFirst({
      where: { id: bookingId, professionalId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: { notes },
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────

  private async resolveWaInstance(
    professionalId: string,
  ): Promise<string | null> {
    const pro = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        waInstanceName: true,
        waStatus: true,
        organizationId: true,
      },
    });
    if (!pro) return null;

    if (pro.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: pro.organizationId },
        select: { waInstanceName: true, waStatus: true },
      });
      if (org?.waInstanceName) {
        return org.waInstanceName;
      }
    }

    if (pro.waInstanceName) {
      return pro.waInstanceName;
    }

    return null;
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = vars[key];
      if (val === undefined || val === null) return '';
      return val;
    });
  }

  // ── Cron helpers (exposed for BookingCronService) ─────────────────

  async getExpiredDepositBookings(): Promise<
    Array<{
      booking: {
        id: string;
        token: string;
        slotDate: Date;
        slotStart: string;
        slotEnd: string;
        patientName: string;
        patientPhone: string;
      };
      appointment: { id: string } | null;
      professional: {
        id: string;
        fullName: string;
        timezone: string;
        organizationId: string | null;
      };
    }>
  > {
    const now = new Date();
    const bookings = await this.prisma.publicBooking.findMany({
      where: {
        status: BookingStatus.BOOKED,
        depositStatus: DepositStatus.PENDING,
        expiresAt: { lt: now },
      },
      include: {
        appointment: { select: { id: true } },
        professional: {
          select: {
            id: true,
            fullName: true,
            timezone: true,
            bookingAutoCancel: true,
            organizationId: true,
          },
        },
      },
    });

    return bookings
      .filter((b) => b.professional.bookingAutoCancel)
      .map((b) => ({
        booking: {
          id: b.id,
          token: b.token,
          slotDate: b.slotDate,
          slotStart: b.slotStart,
          slotEnd: b.slotEnd,
          patientName: b.patientName,
          patientPhone: b.patientPhone,
        },
        appointment: b.appointment,
        professional: {
          id: b.professional.id,
          fullName: b.professional.fullName,
          timezone: b.professional.timezone,
          organizationId: b.professional.organizationId,
        },
      }));
  }

  async expireDepositBooking(
    bookingId: string,
    appointmentId?: string,
  ): Promise<void> {
    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.EXPIRED },
    });

    if (appointmentId) {
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          reason: 'Vencimiento de seña',
        },
      });
    }
  }

  async getPendingDepositReminders(): Promise<
    Array<{
      booking: {
        id: string;
        token: string;
        slotDate: Date;
        slotStart: string;
        slotEnd: string;
        patientName: string;
        patientPhone: string;
      };
      professional: {
        id: string;
        fullName: string;
        timezone: string;
        organizationId: string | null;
        paymentAlias: string | null;
        depositAmount: Prisma.Decimal | null;
      };
    }>
  > {
    const now = new Date();
    const sixHoursFromNow = addMinutes(now, 6 * 60);

    const bookings = await this.prisma.publicBooking.findMany({
      where: {
        status: BookingStatus.BOOKED,
        depositStatus: DepositStatus.PENDING,
        expiresAt: { lte: sixHoursFromNow, gte: now },
        notifiedExpiry: false,
      },
      include: {
        professional: {
          select: {
            id: true,
            fullName: true,
            timezone: true,
            organizationId: true,
            paymentAlias: true,
            depositAmount: true,
          },
        },
      },
    });

    return bookings.map((b) => ({
      booking: {
        id: b.id,
        token: b.token,
        slotDate: b.slotDate,
        slotStart: b.slotStart,
        slotEnd: b.slotEnd,
        patientName: b.patientName,
        patientPhone: b.patientPhone,
      },
      professional: {
        id: b.professional.id,
        fullName: b.professional.fullName,
        timezone: b.professional.timezone,
        organizationId: b.professional.organizationId,
        paymentAlias: b.professional.paymentAlias,
        depositAmount: b.professional.depositAmount,
      },
    }));
  }

  async markNotifiedExpiry(bookingId: string): Promise<void> {
    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: { notifiedExpiry: true },
    });
  }

  /** Build a Date from slotDate + slotStart (AR timezone aware) */
  private slotDateToDate(slotDate: Date, slotStart: string): Date {
    const [h, m] = slotStart.split(':').map(Number);
    const d = new Date(slotDate);
    d.setUTCHours(h + 3, m, 0, 0);
    return d;
  }

  /** Unconfirmed bookings past the warning threshold (slotDate - reminderHours) */
  async getUnconfirmedBookingsForWarning(): Promise<
    Array<{
      booking: {
        id: string;
        token: string;
        slotDate: Date;
        slotStart: string;
        patientName: string;
        patientPhone: string;
      };
      professional: {
        id: string;
        fullName: string;
        timezone: string;
        organizationId: string | null;
        reminderHours: number;
      };
    }>
  > {
    const now = new Date();
    // Only fetch bookings within a reasonable window (max reminderHours is 72, add buffer)
    const minSlotDate = new Date(now.getTime() - 48 * 3600000);
    const maxSlotDate = new Date(now.getTime() + 96 * 3600000);
    const bookings = await this.prisma.publicBooking.findMany({
      where: {
        status: BookingStatus.PENDING_WA_CONFIRMATION,
        unconfirmedWarningSentAt: null,
        slotDate: { gte: minSlotDate, lte: maxSlotDate },
      },
      include: {
        professional: {
          select: {
            id: true,
            fullName: true,
            timezone: true,
            organizationId: true,
            reminderHours: true,
          },
        },
      },
    });

    return bookings
      .filter((b) => {
        const aptTime = this.slotDateToDate(b.slotDate, b.slotStart);
        const warningAt = new Date(
          aptTime.getTime() - b.professional.reminderHours * 3600000,
        );
        return now >= warningAt && now < aptTime;
      })
      .map((b) => ({
        booking: {
          id: b.id,
          token: b.token,
          slotDate: b.slotDate,
          slotStart: b.slotStart,
          patientName: b.patientName,
          patientPhone: b.patientPhone,
        },
        professional: {
          id: b.professional.id,
          fullName: b.professional.fullName,
          timezone: b.professional.timezone,
          organizationId: b.professional.organizationId,
          reminderHours: b.professional.reminderHours,
        },
      }));
  }

  async markUnconfirmedWarningSent(bookingId: string): Promise<void> {
    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: { unconfirmedWarningSentAt: new Date() },
    });
  }

  /** Unconfirmed bookings past the auto-cancel threshold (only if warning was already sent) */
  async getUnconfirmedBookingsForCancel(): Promise<
    Array<{
      booking: {
        id: string;
        token: string;
        slotDate: Date;
        slotStart: string;
        patientName: string;
        patientPhone: string;
      };
      professional: {
        id: string;
        fullName: string;
        organizationId: string | null;
        bookingAutoCancel: boolean;
        bookingAutoCancelHours: number;
      };
    }>
  > {
    const now = new Date();
    // Only warn-if-not-cancel logic: only cancel bookings that were already warned.
    // This prevents cancelling without warning if bookingAutoCancelHours >= reminderHours.
    const minSlotDate = new Date(now.getTime() - 48 * 3600000);
    const maxSlotDate = new Date(now.getTime() + 96 * 3600000);
    const bookings = await this.prisma.publicBooking.findMany({
      where: {
        status: BookingStatus.PENDING_WA_CONFIRMATION,
        unconfirmedWarningSentAt: { not: null },
        slotDate: { gte: minSlotDate, lte: maxSlotDate },
      },
      include: {
        professional: {
          select: {
            id: true,
            fullName: true,
            organizationId: true,
            bookingAutoCancel: true,
            bookingAutoCancelHours: true,
          },
        },
      },
    });

    return bookings
      .filter((b) => {
        if (!b.professional.bookingAutoCancel) return false;
        const aptTime = this.slotDateToDate(b.slotDate, b.slotStart);
        const cancelAt = new Date(
          aptTime.getTime() - b.professional.bookingAutoCancelHours * 3600000,
        );
        return now >= cancelAt && now < aptTime;
      })
      .map((b) => ({
        booking: {
          id: b.id,
          token: b.token,
          slotDate: b.slotDate,
          slotStart: b.slotStart,
          patientName: b.patientName,
          patientPhone: b.patientPhone,
        },
        professional: {
          id: b.professional.id,
          fullName: b.professional.fullName,
          organizationId: b.professional.organizationId,
          bookingAutoCancel: b.professional.bookingAutoCancel,
          bookingAutoCancelHours: b.professional.bookingAutoCancelHours,
        },
      }));
  }

  async expireUnconfirmedBooking(bookingId: string): Promise<void> {
    await this.prisma.publicBooking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.EXPIRED, cancelledAt: new Date(), cancelReason: 'No confirmada a tiempo' },
    });
  }

  /** Resolve intakeCompleted across phone — if this booking doesn't have it,
   *  check if another booking with the same phone does. */
  private async resolveIntakeCompleted(
    professionalId: string,
    booking: { intakeCompleted: boolean; patientPhone: string | null },
  ): Promise<boolean> {
    if (booking.intakeCompleted) return true;
    if (!booking.patientPhone) return false;
    const completed = await this.prisma.publicBooking.findFirst({
      where: {
        professionalId,
        patientPhone: booking.patientPhone,
        intakeCompleted: true,
      },
      select: { id: true },
    });
    return !!completed;
  }
}
