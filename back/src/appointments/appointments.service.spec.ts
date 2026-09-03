import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

function buildService(prismaMock: any) {
  const whatsappMock = {
    sendAppointmentCreated: jest.fn(),
    sendAppointmentReminder: jest.fn(),
    processPatientReply: jest.fn(),
    sendSystemText: jest.fn(),
  };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
  return new AppointmentsService(
    prismaMock,
    whatsappMock as any,
    notificationsMock as any,
  );
}

// 09:00 ART = 12:00 UTC. Rango semanal 09:00–12:00 sin capacity explícita.
function buildOverlapPrismaMock(options: {
  maxSimultaneous?: number | null;
  overlappingCount: number;
  rangeCapacity?: number | null;
}) {
  return {
    professional: {
      findUnique: jest.fn().mockResolvedValue(
        options.maxSimultaneous === undefined
          ? {}
          : { maxSimultaneous: options.maxSimultaneous },
      ),
    },
    specificDateAvailability: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    weeklyAvailability: {
      findUnique: jest.fn().mockResolvedValue({
        isEnabled: true,
        ranges: [
          {
            startTime: '09:00',
            endTime: '12:00',
            capacity: options.rangeCapacity ?? null,
          },
        ],
      }),
    },
    appointment: {
      count: jest.fn().mockResolvedValue(options.overlappingCount),
    },
  };
}

const SLOT_START = new Date('2026-04-20T12:00:00.000Z');
const SLOT_END = new Date('2026-04-20T12:30:00.000Z');

describe('AppointmentsService', () => {
  it('al pasar a ATTENDED crea o actualiza revenue', async () => {
    const appointment = {
      id: 'app-1',
      professionalId: 'prof-1',
      patientId: 'pat-1',
      startAt: new Date('2026-04-19T14:00:00.000Z'),
      endAt: new Date('2026-04-19T14:30:00.000Z'),
      durationMinutes: 30,
      bufferMinutes: 10,
      status: AppointmentStatus.CONFIRMED,
      fee: new Prisma.Decimal(1000),
      reason: null,
      cancelledAt: null,
      attendedAt: null,
      reminderScheduledFor: null,
      reminderSentAt: null,
      reminderJobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const prismaMock: any = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(appointment),
        update: jest.fn().mockResolvedValue({
          ...appointment,
          status: AppointmentStatus.ATTENDED,
        }),
      },
      revenue: {
        upsert: jest.fn().mockResolvedValue({ id: 'rev-1' }),
      },
    };

    const whatsappMock = {
      sendAppointmentCreated: jest.fn(),
      sendAppointmentReminder: jest.fn(),
      processPatientReply: jest.fn(),
      sendSystemText: jest.fn(),
    };

    const notificationsMock = {
      create: jest.fn().mockResolvedValue({}),
    };

    const service = new AppointmentsService(
      prismaMock,
      whatsappMock as any,
      notificationsMock as any,
    );

    await service.changeStatus(
      { role: 'INDEPENDENT', professionalId: 'prof-1', organizationId: null },
      'app-1',
      { status: AppointmentStatus.ATTENDED },
    );

    expect(prismaMock.revenue.upsert).toHaveBeenCalledTimes(1);
  });

  describe('ensureSlotAvailable con maxSimultaneous global', () => {
    it('con max=1, el segundo turno encimado se rechaza con 400', async () => {
      const prismaMock = buildOverlapPrismaMock({
        maxSimultaneous: 1,
        overlappingCount: 1,
      });
      const service = buildService(prismaMock);

      await expect(
        (service as any).ensureSlotAvailable('prof-1', SLOT_START, SLOT_END),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('con max=1 y sin solape, permite crear', async () => {
      const prismaMock = buildOverlapPrismaMock({
        maxSimultaneous: 1,
        overlappingCount: 0,
      });
      const service = buildService(prismaMock);

      await expect(
        (service as any).ensureSlotAvailable('prof-1', SLOT_START, SLOT_END),
      ).resolves.toBeUndefined();
    });

    it('con max=2, el segundo turno encimado se permite y el tercero no', async () => {
      const serviceOk = buildService(
        buildOverlapPrismaMock({ maxSimultaneous: 2, overlappingCount: 1 }),
      );
      await expect(
        (serviceOk as any).ensureSlotAvailable('prof-1', SLOT_START, SLOT_END),
      ).resolves.toBeUndefined();

      const serviceFull = buildService(
        buildOverlapPrismaMock({ maxSimultaneous: 2, overlappingCount: 2 }),
      );
      await expect(
        (serviceFull as any).ensureSlotAvailable(
          'prof-1',
          SLOT_START,
          SLOT_END,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('con maxSimultaneous null (sin límite), no rechaza aunque haya solapes', async () => {
      const prismaMock = buildOverlapPrismaMock({
        maxSimultaneous: null,
        overlappingCount: 5,
      });
      const service = buildService(prismaMock);

      await expect(
        (service as any).ensureSlotAvailable('prof-1', SLOT_START, SLOT_END),
      ).resolves.toBeUndefined();
    });

    it('la capacity explícita del rango tiene prioridad sobre el global', async () => {
      const serviceOk = buildService(
        buildOverlapPrismaMock({
          maxSimultaneous: 1,
          overlappingCount: 1,
          rangeCapacity: 3,
        }),
      );
      await expect(
        (serviceOk as any).ensureSlotAvailable('prof-1', SLOT_START, SLOT_END),
      ).resolves.toBeUndefined();

      const serviceFull = buildService(
        buildOverlapPrismaMock({
          maxSimultaneous: 1,
          overlappingCount: 3,
          rangeCapacity: 3,
        }),
      );
      await expect(
        (serviceFull as any).ensureSlotAvailable(
          'prof-1',
          SLOT_START,
          SLOT_END,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
