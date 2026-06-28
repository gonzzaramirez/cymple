import { validate } from 'class-validator';
import { UpdateMemberProfessionalDto } from './update-member-professional.dto';

describe('UpdateMemberProfessionalDto', () => {
  it('accepts valid slug format', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.publicBookingSlug = 'dr-smith-online';

    const errors = await validate(dto);
    const slugError = errors.find((e) => e.property === 'publicBookingSlug');
    expect(slugError).toBeUndefined();
  });

  it('rejects slug with uppercase letters', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.publicBookingSlug = 'Dr-Smith';

    const errors = await validate(dto);
    const slugError = errors.find((e) => e.property === 'publicBookingSlug');
    expect(slugError).toBeDefined();
  });

  it('rejects slug with spaces', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.publicBookingSlug = 'dr smith';

    const errors = await validate(dto);
    const slugError = errors.find((e) => e.property === 'publicBookingSlug');
    expect(slugError).toBeDefined();
  });

  it('accepts valid slug with trailing numbers', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.publicBookingSlug = 'dr-smith-123';

    const errors = await validate(dto);
    const slugError = errors.find((e) => e.property === 'publicBookingSlug');
    expect(slugError).toBeUndefined();
  });

  it('rejects negative depositAmount', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.depositAmount = -1;

    const errors = await validate(dto);
    const depositError = errors.find((e) => e.property === 'depositAmount');
    expect(depositError).toBeDefined();
  });

  it('accepts null depositAmount', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.depositAmount = null;

    const errors = await validate(dto);
    const depositError = errors.find((e) => e.property === 'depositAmount');
    expect(depositError).toBeUndefined();
  });

  it('rejects maxActiveBookings below 1', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.maxActiveBookings = 0;

    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'maxActiveBookings');
    expect(err).toBeDefined();
  });

  it('accepts maxActiveBookings of 1', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.maxActiveBookings = 1;

    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'maxActiveBookings');
    expect(err).toBeUndefined();
  });

  it('accepts valid depositAmount with decimal places', async () => {
    const dto = new UpdateMemberProfessionalDto();
    dto.depositAmount = 100.5;

    const errors = await validate(dto);
    const depositError = errors.find((e) => e.property === 'depositAmount');
    expect(depositError).toBeUndefined();
  });

  it('accepts empty DTO (all optional)', async () => {
    const dto = new UpdateMemberProfessionalDto();

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
