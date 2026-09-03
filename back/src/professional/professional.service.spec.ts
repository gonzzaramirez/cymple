import { ProfessionalService } from './professional.service';

describe('ProfessionalService', () => {
  let service: ProfessionalService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      professional: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ProfessionalService(prismaMock);
  });

  describe('getSettings()', () => {
    it('selects intakeEnabled and depositEnabled fields', async () => {
      const mockResult = {
        id: 'prof-1',
        intakeEnabled: true,
        depositEnabled: false,
      };
      prismaMock.professional.findUniqueOrThrow.mockResolvedValue(mockResult);

      const result = await service.getSettings('prof-1');
      expect(result).toHaveProperty('intakeEnabled', true);
      expect(result).toHaveProperty('depositEnabled', false);

      // Verify the select includes the new fields
      const selectArg =
        prismaMock.professional.findUniqueOrThrow.mock.calls[0][0].select;
      expect(selectArg).toHaveProperty('intakeEnabled', true);
      expect(selectArg).toHaveProperty('depositEnabled', true);
    });
  });

  describe('updateSettings()', () => {    it('selects intakeEnabled and depositEnabled in response', async () => {
      const dto = { intakeEnabled: false, depositEnabled: true };
      const mockResult = {
        id: 'prof-1',
        intakeEnabled: false,
        depositEnabled: true,
      };
      prismaMock.professional.update.mockResolvedValue(mockResult);

      const result = await service.updateSettings('prof-1', dto as any);
      expect(result).toHaveProperty('intakeEnabled', false);
      expect(result).toHaveProperty('depositEnabled', true);

      const selectArg = prismaMock.professional.update.mock.calls[0][0].select;
      expect(selectArg).toHaveProperty('intakeEnabled', true);
      expect(selectArg).toHaveProperty('depositEnabled', true);
    });
  });

  describe('maxSimultaneous', () => {
    it('incluye maxSimultaneous en get y update de settings', async () => {
      prismaMock.professional.findUniqueOrThrow.mockResolvedValue({
        id: 'prof-1',
        maxSimultaneous: 1,
      });
      await service.getSettings('prof-1');
      expect(
        prismaMock.professional.findUniqueOrThrow.mock.calls[0][0].select,
      ).toHaveProperty('maxSimultaneous', true);

      prismaMock.professional.update.mockResolvedValue({
        id: 'prof-1',
        maxSimultaneous: null,
      });
      await service.updateSettings('prof-1', {
        maxSimultaneous: null,
      } as any);
      expect(
        prismaMock.professional.update.mock.calls[0][0].select,
      ).toHaveProperty('maxSimultaneous', true);
      expect(prismaMock.professional.update.mock.calls[0][0].data).toMatchObject(
        { maxSimultaneous: null },
      );
    });
  });
});
