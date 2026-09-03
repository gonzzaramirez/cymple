import { AvailabilityService } from './availability.service';
import { Weekday } from '@prisma/client';

describe('AvailabilityService', () => {
  it('genera slots con duración + buffer', async () => {
    const prismaMock: any = {
      professional: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          consultationMinutes: 30,
          bufferMinutes: 10,
        }),
      },
      specificDateAvailability: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      weeklyAvailability: {
        findUnique: jest.fn().mockResolvedValue({
          isEnabled: true,
          ranges: [{ startTime: '09:00', endTime: '13:00' }],
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new AvailabilityService(prismaMock);
    jest
      .spyOn<any, any>(service as any, 'dateToWeekday')
      .mockReturnValue(Weekday.MONDAY);

    const result = await service.getSlots('prof-1', '2026-04-20T00:00:00.000Z');
    expect(result.slots).toHaveLength(6);
  });

  it('usa maxSimultaneous como fallback cuando el rango tiene capacity null', async () => {
    const prismaMock: any = {
      professional: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          consultationMinutes: 30,
          bufferMinutes: 10,
          maxSimultaneous: 2,
        }),
      },
      specificDateAvailability: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      weeklyAvailability: {
        findUnique: jest.fn().mockResolvedValue({
          isEnabled: true,
          ranges: [{ startTime: '09:00', endTime: '10:00', capacity: null }],
        }),
      },
      appointment: {
        // Un turno solapado con el primer slot (09:00 ART = 12:00 UTC)
        findMany: jest.fn().mockResolvedValue([
          {
            startAt: new Date('2026-04-20T12:05:00.000Z'),
            endAt: new Date('2026-04-20T12:35:00.000Z'),
          },
        ]),
      },
    };

    const service = new AvailabilityService(prismaMock);
    jest
      .spyOn<any, any>(service as any, 'dateToWeekday')
      .mockReturnValue(Weekday.MONDAY);

    const result = await service.getSlots('prof-1', '2026-04-20T00:00:00.000Z');
    expect(result.slots[0]).toMatchObject({
      bookedCount: 1,
      remainingCapacity: 1,
      hasCapacityLimit: true,
    });
  });

  it('maxSimultaneous null = sin límite aunque el rango tenga capacity null', async () => {
    const prismaMock: any = {
      professional: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          consultationMinutes: 30,
          bufferMinutes: 10,
          maxSimultaneous: null,
        }),
      },
      specificDateAvailability: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      weeklyAvailability: {
        findUnique: jest.fn().mockResolvedValue({
          isEnabled: true,
          ranges: [{ startTime: '09:00', endTime: '10:00', capacity: null }],
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            startAt: new Date('2026-04-20T12:05:00.000Z'),
            endAt: new Date('2026-04-20T12:35:00.000Z'),
          },
        ]),
      },
    };

    const service = new AvailabilityService(prismaMock);
    jest
      .spyOn<any, any>(service as any, 'dateToWeekday')
      .mockReturnValue(Weekday.MONDAY);

    const result = await service.getSlots('prof-1', '2026-04-20T00:00:00.000Z');
    expect(result.slots[0]).toMatchObject({
      bookedCount: 1,
      remainingCapacity: null,
      hasCapacityLimit: false,
    });
  });

  it('la capacity explícita del rango tiene prioridad sobre maxSimultaneous', async () => {
    const prismaMock: any = {
      professional: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          consultationMinutes: 30,
          bufferMinutes: 10,
          maxSimultaneous: 1,
        }),
      },
      specificDateAvailability: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      weeklyAvailability: {
        findUnique: jest.fn().mockResolvedValue({
          isEnabled: true,
          ranges: [{ startTime: '09:00', endTime: '10:00', capacity: 3 }],
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            startAt: new Date('2026-04-20T12:05:00.000Z'),
            endAt: new Date('2026-04-20T12:35:00.000Z'),
          },
        ]),
      },
    };

    const service = new AvailabilityService(prismaMock);
    jest
      .spyOn<any, any>(service as any, 'dateToWeekday')
      .mockReturnValue(Weekday.MONDAY);

    const result = await service.getSlots('prof-1', '2026-04-20T00:00:00.000Z');
    expect(result.slots[0]).toMatchObject({
      bookedCount: 1,
      remainingCapacity: 2,
      hasCapacityLimit: true,
    });
  });
});
