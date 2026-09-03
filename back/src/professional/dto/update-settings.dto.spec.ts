import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfessionalSettingsDto } from './update-settings.dto';

describe('UpdateProfessionalSettingsDto', () => {
  it('accepts empty DTO (all optional)', async () => {
    const dto = new UpdateProfessionalSettingsDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid boolean for intakeEnabled', async () => {
    const dto = new UpdateProfessionalSettingsDto();
    (dto as any).intakeEnabled = true;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'intakeEnabled');
    expect(err).toBeUndefined();
  });

  it('accepts valid boolean for depositEnabled', async () => {
    const dto = new UpdateProfessionalSettingsDto();
    (dto as any).depositEnabled = false;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'depositEnabled');
    expect(err).toBeUndefined();
  });

  it('rejects non-boolean for intakeEnabled', async () => {
    const dto = new UpdateProfessionalSettingsDto();
    (dto as any).intakeEnabled = 'yes';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'intakeEnabled');
    expect(err).toBeDefined();
  });

  it('rejects non-boolean for depositEnabled', async () => {
    const dto = new UpdateProfessionalSettingsDto();
    (dto as any).depositEnabled = 'no';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'depositEnabled');
    expect(err).toBeDefined();
  });

  it('accepts maxSimultaneous >= 1', async () => {
    const dto = plainToInstance(UpdateProfessionalSettingsDto, {
      maxSimultaneous: 3,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'maxSimultaneous')).toBeUndefined();
    expect(dto.maxSimultaneous).toBe(3);
  });

  it('transforms maxSimultaneous 0 to null (sin límite)', async () => {
    const dto = plainToInstance(UpdateProfessionalSettingsDto, {
      maxSimultaneous: 0,
    });
    expect(dto.maxSimultaneous).toBeNull();
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'maxSimultaneous')).toBeUndefined();
  });

  it('rejects maxSimultaneous < 0', async () => {
    const dto = plainToInstance(UpdateProfessionalSettingsDto, {
      maxSimultaneous: -1,
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'maxSimultaneous'),
    ).toBeDefined();
  });
});
