import { AppointmentStatus, Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

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
});
