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
});
