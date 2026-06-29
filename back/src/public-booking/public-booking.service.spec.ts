import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicBookingService } from './public-booking.service';

describe('PublicBookingService - Org methods', () => {
  let service: PublicBookingService;
  let prismaMock: any;

  const mockProfessional = {
    id: 'prof-1',
    fullName: 'Dr. Smith',
    slug: 'dr-smith',
    publicBookingSlug: 'dr-smith',
    organizationId: 'org-1',
  };

  const mockBooking = {
    id: 'booking-1',
    token: 'R-001',
    professionalId: 'prof-1',
    patientId: 'patient-1',
    appointmentId: 'apt-1',
    slotDate: new Date('2026-06-15'),
    slotStart: '10:00',
    slotEnd: '10:30',
    patientName: 'John Doe',
    patientPhone: '+5491122334455',
    status: 'BOOKED',
    depositStatus: 'PENDING',
    depositAmount: null,
    depositPaidAt: null,
    depositPaidBy: null,
    intakeCompleted: false,
    expiresAt: new Date(),
    waContactedAt: null,
    cancelledAt: null,
    cancelReason: null,
    notes: null,
    waMessageId: null,
    notifiedExpiry: false,
    unconfirmedWarningSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookingDetail = {
    ...mockBooking,
    patient: {
      id: 'patient-1',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+5491122334455',
    },
    appointment: {
      id: 'apt-1',
      startAt: new Date('2026-06-15T13:00:00Z'),
      endAt: new Date('2026-06-15T13:30:00Z'),
      status: 'CONFIRMED',
    },
  };

  const mockBookingWithProfessional = {
    ...mockBookingDetail,
    professional: {
      fullName: 'Dr. Smith',
      slug: 'dr-smith',
      publicBookingSlug: 'dr-smith',
    },
  };

  beforeEach(() => {
    prismaMock = {
      organization: {
        findUnique: jest.fn(),
      },
      professional: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      publicBooking: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      appointment: {
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const availabilityMock = {};
    const evolutionMock = {};
    const notificationsMock = {};
    const configMock = {};
    const messageTemplatesMock = {};

    service = new PublicBookingService(
      prismaMock as any,
      availabilityMock as any,
      evolutionMock as any,
      notificationsMock as any,
      configMock as any,
      messageTemplatesMock as any,
    );
  });

  // ───────────────────────────────────────────────────────
  //  3.1 — listOrgBookings
  // ───────────────────────────────────────────────────────

  describe('listOrgBookings()', () => {
    it('returns paginated bookings across org professionals', async () => {
      prismaMock.professional.findMany.mockResolvedValue([
        { id: 'prof-1' },
        { id: 'prof-2' },
      ]);
      prismaMock.$transaction.mockResolvedValue([
        [mockBookingWithProfessional],
        1,
      ]);

      const result = await service.listOrgBookings('org-1', {});

      expect(prismaMock.professional.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        select: { id: true },
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('returns empty when org has no professionals', async () => {
      prismaMock.professional.findMany.mockResolvedValue([]);

      const result = await service.listOrgBookings('org-1', { page: 1, limit: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────
  //  3.2 — getOrgBookingDetail
  // ───────────────────────────────────────────────────────

  describe('getOrgBookingDetail()', () => {
    it('returns booking detail when booking belongs to org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(mockBookingDetail);
      prismaMock.professional.findUnique.mockResolvedValue(mockProfessional);

      const result = await service.getOrgBookingDetail('org-1', 'booking-1');

      expect(prismaMock.publicBooking.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'booking-1',
          professional: { organizationId: 'org-1' },
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
      expect(result.id).toBe('booking-1');
      expect(result.professionalName).toBe('Dr. Smith');
    });

    it('throws NotFoundException when booking belongs to other org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.getOrgBookingDetail('org-2', 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────
  //  3.3 — markOrgDepositPaid
  // ───────────────────────────────────────────────────────

  describe('markOrgDepositPaid()', () => {
    it('marks deposit as paid when booking belongs to org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(mockBooking);

      await service.markOrgDepositPaid('org-1', 'booking-1');

      expect(prismaMock.publicBooking.findFirst).toHaveBeenCalledWith({
        where: { id: 'booking-1', professional: { organizationId: 'org-1' } },
      });
      expect(prismaMock.publicBooking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: {
          depositStatus: 'PAID',
          depositPaidAt: expect.any(Date),
          depositPaidBy: 'MANUAL',
        },
      });
    });

    it('throws NotFoundException when booking belongs to other org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.markOrgDepositPaid('org-2', 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────
  //  3.4 — cancelOrgBooking
  // ───────────────────────────────────────────────────────

  describe('cancelOrgBooking()', () => {
    it('cancels booking and linked appointment', async () => {
      const bookingWithAppointment = {
        ...mockBooking,
        appointment: { id: 'apt-1', status: 'CONFIRMED' },
      };
      prismaMock.publicBooking.findFirst.mockResolvedValue(bookingWithAppointment);

      await service.cancelOrgBooking('org-1', 'booking-1', 'Motivo de prueba');

      expect(prismaMock.publicBooking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancelReason: 'Motivo de prueba',
        },
      });
      expect(prismaMock.appointment.update).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          reason: 'Motivo de prueba',
        },
      });
    });

    it('throws NotFoundException when booking not found in org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelOrgBooking('org-2', 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────
  //  3.5 — manualOrgConfirm
  // ───────────────────────────────────────────────────────

  describe('manualOrgConfirm()', () => {
    it('throws NotFoundException when booking belongs to other org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.manualOrgConfirm('org-2', 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────
  //  3.6 — updateOrgNotes
  // ───────────────────────────────────────────────────────

  describe('updateOrgNotes()', () => {
    it('updates notes when booking belongs to org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(mockBooking);

      await service.updateOrgNotes('org-1', 'booking-1', 'Nuevas notas');

      expect(prismaMock.publicBooking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { notes: 'Nuevas notas' },
      });
    });

    it('throws NotFoundException when booking belongs to other org', async () => {
      prismaMock.publicBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.updateOrgNotes('org-2', 'booking-1', 'notas'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────
  //  4.1 — getOrganizationProfessionals (public route gate)
  // ───────────────────────────────────────────────────────

  describe('getOrganizationProfessionals()', () => {
    it('returns professionals when org has public booking enabled', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        publicBookingEnabled: true,
      });
      prismaMock.professional.findMany.mockResolvedValue([
        {
          id: 'prof-1',
          fullName: 'Dr. Smith',
          specialty: 'Cardiología',
          depositAmount: null,
          depositWindowHours: 24,
          consultationMinutes: 30,
          standardFee: new Prisma.Decimal(5000),
          paymentAlias: null,
          publicBookingSlug: 'dr-smith',
        },
      ]);

      const result = await service.getOrganizationProfessionals('test-org');

      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe('Dr. Smith');
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-org' },
        select: { id: true, publicBookingEnabled: true },
      });
    });

    it('returns empty array when org has public booking disabled', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        publicBookingEnabled: false,
      });

      const result = await service.getOrganizationProfessionals('test-org');

      expect(result).toEqual([]);
      // Professionals should NOT be queried
      expect(prismaMock.professional.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when org not found', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const result = await service.getOrganizationProfessionals('non-existent');

      expect(result).toEqual([]);
      expect(prismaMock.professional.findMany).not.toHaveBeenCalled();
    });
  });
});
