import { BadRequestException } from '@nestjs/common';
import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  it('bloquea eliminación si tiene turnos futuros', async () => {
    const prismaMock: any = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pat-1',
          professionalId: 'prof-1',
        }),
      },
      appointment: {
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const service = new PatientsService(prismaMock);

    await expect(service.remove('prof-1', 'pat-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
