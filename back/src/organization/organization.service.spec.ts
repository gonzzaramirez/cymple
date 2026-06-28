import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrganizationService } from './organization.service';
import { UpdateMemberProfessionalDto } from './dto/update-member-professional.dto';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prismaMock: any;

  const mockProfessional = {
    id: 'prof-1',
    slug: 'test-org-dr-smith',
    fullName: 'Dr. Smith',
    email: 'smith@test.com',
    phone: '+54911',
    specialty: 'Cardiología',
    timezone: 'America/Argentina/Buenos_Aires',
    consultationMinutes: 30,
    bufferMinutes: 10,
    standardFee: new Prisma.Decimal(5000),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookingFields = {
    publicBookingEnabled: true,
    publicBookingSlug: 'dr-smith-online',
    depositAmount: new Prisma.Decimal(1000),
    depositWindowHours: 24,
    paymentAlias: 'alias.mp',
    bookingAutoCancel: true,
    bookingAutoCancelHours: 4,
    maxActiveBookings: 5,
    waPublicBookingPhone: '+5491122334455',
  };

  const mockBookingResponse = {
    publicBookingEnabled: true,
    publicBookingSlug: 'dr-smith-online',
    depositAmount: new Prisma.Decimal(1000),
    depositWindowHours: 24,
    paymentAlias: 'alias.mp',
    bookingAutoCancel: true,
    bookingAutoCancelHours: 4,
    maxActiveBookings: 5,
    waPublicBookingPhone: '+5491122334455',
  };

  beforeEach(() => {
    prismaMock = {
      professional: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      appointment: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      patient: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      revenue: {
        aggregate: jest.fn(),
      },
      organization: {
        findUniqueOrThrow: jest.fn(),
      },
    };

    service = new OrganizationService(prismaMock as any);
  });

  // ───────────────────────────────────────────────────────
  //  2.1 — listProfessionals with search/filter
  // ───────────────────────────────────────────────────────

  describe('listProfessionals()', () => {
    it('shows booking fields in select and enriches with stats', async () => {
      const professionalRow = {
        ...mockProfessional,
        ...mockBookingResponse,
      };

      prismaMock.professional.findMany.mockResolvedValue([professionalRow]);
      prismaMock.appointment.groupBy.mockResolvedValue([
        { professionalId: 'prof-1', _count: { id: 5 } },
      ]);
      prismaMock.patient.groupBy.mockResolvedValue([
        { professionalId: 'prof-1', _count: { id: 3 } },
      ]);

      const result = await service.listProfessionals('org-1');

      // Verify booking fields are in select
      const selectArg = prismaMock.professional.findMany.mock.calls[0][0].select;
      expect(selectArg.publicBookingEnabled).toBe(true);
      expect(selectArg.publicBookingSlug).toBe(true);
      expect(selectArg.depositAmount).toBe(true);
      expect(selectArg.depositWindowHours).toBe(true);
      expect(selectArg.paymentAlias).toBe(true);
      expect(selectArg.bookingAutoCancel).toBe(true);
      expect(selectArg.bookingAutoCancelHours).toBe(true);
      expect(selectArg.maxActiveBookings).toBe(true);
      expect(selectArg.waPublicBookingPhone).toBe(true);

      // Verify booking fields are in response
      expect(result[0].publicBookingEnabled).toBe(true);
      expect(result[0].publicBookingSlug).toBe('dr-smith-online');
      expect(result[0].depositAmount).toEqual(new Prisma.Decimal(1000));
      expect(result[0].totalAppointments).toBe(5);
      expect(result[0].totalPatients).toBe(3);
    });

    it('filters by fullName when search param is provided', async () => {
      prismaMock.professional.findMany.mockResolvedValue([mockProfessional]);
      prismaMock.appointment.groupBy.mockResolvedValue([]);
      prismaMock.patient.groupBy.mockResolvedValue([]);

      await service.listProfessionals('org-1', 'Smith');

      const whereArg = prismaMock.professional.findMany.mock.calls[0][0].where;
      expect(whereArg.fullName).toEqual({
        contains: 'Smith',
        mode: 'insensitive',
      });
    });

    it('filters by isActive=true when status=active', async () => {
      prismaMock.professional.findMany.mockResolvedValue([mockProfessional]);
      prismaMock.appointment.groupBy.mockResolvedValue([]);
      prismaMock.patient.groupBy.mockResolvedValue([]);

      await service.listProfessionals('org-1', undefined, 'active');

      const whereArg = prismaMock.professional.findMany.mock.calls[0][0].where;
      expect(whereArg.isActive).toBe(true);
    });

    it('filters by isActive=false when status=inactive', async () => {
      prismaMock.professional.findMany.mockResolvedValue([mockProfessional]);
      prismaMock.appointment.groupBy.mockResolvedValue([]);
      prismaMock.patient.groupBy.mockResolvedValue([]);

      await service.listProfessionals('org-1', undefined, 'inactive');

      const whereArg = prismaMock.professional.findMany.mock.calls[0][0].where;
      expect(whereArg.isActive).toBe(false);
    });

    it('omits isActive filter when status=all', async () => {
      prismaMock.professional.findMany.mockResolvedValue([mockProfessional]);
      prismaMock.appointment.groupBy.mockResolvedValue([]);
      prismaMock.patient.groupBy.mockResolvedValue([]);

      await service.listProfessionals('org-1', undefined, 'all');

      const whereArg = prismaMock.professional.findMany.mock.calls[0][0].where;
      expect(whereArg.isActive).toBeUndefined();
    });

    it('returns empty array when no professionals match', async () => {
      prismaMock.professional.findMany.mockResolvedValue([]);

      const result = await service.listProfessionals('org-1', 'xyzzy');

      expect(result).toEqual([]);
      expect(prismaMock.professional.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────
  //  2.2 — updateProfessional with booking fields
  // ───────────────────────────────────────────────────────

  describe('updateProfessional()', () => {
    beforeEach(() => {
      prismaMock.professional.findFirst.mockResolvedValue(mockProfessional);
    });

    it('persists all booking fields when provided', async () => {
      const dto: UpdateMemberProfessionalDto = {
        publicBookingEnabled: true,
        publicBookingSlug: 'dr-smith-updated',
        depositAmount: 2000,
        depositWindowHours: 48,
        paymentAlias: 'alias.updated',
        bookingAutoCancel: false,
        bookingAutoCancelHours: 6,
        maxActiveBookings: 10,
        waPublicBookingPhone: '+5491122334466',
      };

      const updatedRow = {
        ...mockProfessional,
        ...mockBookingResponse,
        depositAmount: new Prisma.Decimal(2000),
        updatedAt: new Date(),
      };

      prismaMock.professional.update.mockResolvedValue(updatedRow);

      const result = await service.updateProfessional('org-1', 'prof-1', dto);

      const dataArg = prismaMock.professional.update.mock.calls[0][0].data;

      expect(dataArg.publicBookingEnabled).toBe(true);
      expect(dataArg.publicBookingSlug).toBe('dr-smith-updated');
      expect(dataArg.depositAmount).toEqual(new Prisma.Decimal(2000));
      expect(dataArg.depositWindowHours).toBe(48);
      expect(dataArg.paymentAlias).toBe('alias.updated');
      expect(dataArg.bookingAutoCancel).toBe(false);
      expect(dataArg.bookingAutoCancelHours).toBe(6);
      expect(dataArg.maxActiveBookings).toBe(10);
      expect(dataArg.waPublicBookingPhone).toBe('+5491122334466');

      // Verify select includes booking fields + updatedAt
      const selectArg = prismaMock.professional.update.mock.calls[0][0].select;
      expect(selectArg.publicBookingEnabled).toBe(true);
      expect(selectArg.depositAmount).toBe(true);
      expect(selectArg.updatedAt).toBe(true);
    });

    it('converts null depositAmount to Prisma.Decimal(null)', async () => {
      const dto: UpdateMemberProfessionalDto = {
        depositAmount: null,
      };

      const updatedRow = {
        ...mockProfessional,
        depositAmount: null,
        updatedAt: new Date(),
      };

      prismaMock.professional.update.mockResolvedValue(updatedRow);

      await service.updateProfessional('org-1', 'prof-1', dto);

      const dataArg = prismaMock.professional.update.mock.calls[0][0].data;
      expect(dataArg.depositAmount).toBeNull();
    });

    it('skips undefined booking fields', async () => {
      const dto: UpdateMemberProfessionalDto = {
        fullName: 'Dr. Updated',
      };

      prismaMock.professional.update.mockResolvedValue({
        ...mockProfessional,
        fullName: 'Dr. Updated',
        updatedAt: new Date(),
      });

      await service.updateProfessional('org-1', 'prof-1', dto);

      const dataArg = prismaMock.professional.update.mock.calls[0][0].data;
      // Only fullName should be present
      expect(dataArg.fullName).toBe('Dr. Updated');
      expect(dataArg.publicBookingEnabled).toBeUndefined();
      expect(dataArg.publicBookingSlug).toBeUndefined();
      expect(dataArg.depositAmount).toBeUndefined();
      expect(dataArg.depositWindowHours).toBeUndefined();
      expect(dataArg.paymentAlias).toBeUndefined();
      expect(dataArg.bookingAutoCancel).toBeUndefined();
      expect(dataArg.bookingAutoCancelHours).toBeUndefined();
      expect(dataArg.maxActiveBookings).toBeUndefined();
      expect(dataArg.waPublicBookingPhone).toBeUndefined();
    });

    it('throws ConflictException on slug collision', async () => {
      const dto: UpdateMemberProfessionalDto = {
        publicBookingSlug: 'taken-slug',
      };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.16.1',
          meta: { target: ['publicBookingSlug'] },
        },
      );

      prismaMock.professional.update.mockRejectedValue(prismaError);

      await expect(
        service.updateProfessional('org-1', 'prof-1', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ───────────────────────────────────────────────────────
  //  2.3 — handleConflictError slug-specific
  // ───────────────────────────────────────────────────────

  describe('handleConflictError()', () => {
    // Access via a helper that reaches the private method indirectly
    // by triggering a known conflict scenario in updateProfessional

    it('throws slug-specific message when publicBookingSlug is the conflict target', async () => {
      prismaMock.professional.findFirst.mockResolvedValue(mockProfessional);

      const dto: UpdateMemberProfessionalDto = {
        publicBookingSlug: 'already-used',
      };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.16.1',
          meta: { target: ['publicBookingSlug'] },
        },
      );

      prismaMock.professional.update.mockRejectedValue(prismaError);

      await expect(
        service.updateProfessional('org-1', 'prof-1', dto),
      ).rejects.toThrow('El slug de turnos online ya está en uso');
    });

    it('throws generic conflict when email is the conflict target', async () => {
      prismaMock.professional.findFirst.mockResolvedValue(mockProfessional);

      const dto: UpdateMemberProfessionalDto = {};

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.16.1',
          meta: { target: ['email'] },
        },
      );

      prismaMock.professional.update.mockRejectedValue(prismaError);

      await expect(
        service.updateProfessional('org-1', 'prof-1', dto),
      ).rejects.toThrow('Ya existe un profesional con ese email');
    });

    it('re-throws non-P2002 errors', async () => {
      prismaMock.professional.findFirst.mockResolvedValue(mockProfessional);

      const error = new Error('Random DB error');
      prismaMock.professional.update.mockRejectedValue(error);

      await expect(
        service.updateProfessional('org-1', 'prof-1', {}),
      ).rejects.toThrow('Random DB error');
    });
  });
});
