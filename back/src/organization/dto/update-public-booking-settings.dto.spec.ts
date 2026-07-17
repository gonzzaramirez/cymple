import { validate } from 'class-validator';
import { UpdatePublicBookingSettingsDto } from './update-public-booking-settings.dto';

describe('UpdatePublicBookingSettingsDto', () => {
  it('accepts empty DTO (all optional)', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid boolean for publicBookingEnabled', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    dto.publicBookingEnabled = true;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'publicBookingEnabled');
    expect(err).toBeUndefined();
  });

  it('rejects non-boolean for publicBookingEnabled', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).publicBookingEnabled = 'yes';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'publicBookingEnabled');
    expect(err).toBeDefined();
  });

  it('accepts valid slug format', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    dto.publicBookingSlug = 'my-center-online';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'publicBookingSlug');
    expect(err).toBeUndefined();
  });

  it('rejects slug with uppercase letters', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    dto.publicBookingSlug = 'My-Center';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'publicBookingSlug');
    expect(err).toBeDefined();
  });

  it('rejects negative depositWindowHours', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).depositWindowHours = -1;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'depositWindowHours');
    expect(err).toBeDefined();
  });

  it('accepts null depositAmount', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    dto.depositAmount = null;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'depositAmount');
    expect(err).toBeUndefined();
  });

  it('rejects maxActiveBookings below 0', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).maxActiveBookings = -1;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'maxActiveBookings');
    expect(err).toBeDefined();
  });

  it('accepts valid boolean for bookingAutoCancel', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    dto.bookingAutoCancel = false;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'bookingAutoCancel');
    expect(err).toBeUndefined();
  });

  it('accepts valid boolean for intakeEnabled', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).intakeEnabled = true;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'intakeEnabled');
    expect(err).toBeUndefined();
  });

  it('accepts valid boolean for depositEnabled', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).depositEnabled = false;
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'depositEnabled');
    expect(err).toBeUndefined();
  });

  it('rejects non-boolean for intakeEnabled', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).intakeEnabled = 'yes';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'intakeEnabled');
    expect(err).toBeDefined();
  });

  it('rejects non-boolean for depositEnabled', async () => {
    const dto = new UpdatePublicBookingSettingsDto();
    (dto as any).depositEnabled = 'no';
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'depositEnabled');
    expect(err).toBeDefined();
  });
});
