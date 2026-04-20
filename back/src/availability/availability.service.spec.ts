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
});
