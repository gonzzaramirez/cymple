import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMemberProfessionalDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  consultationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  standardFee?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  publicBookingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  publicBookingSlug?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositWindowHours?: number;

  @IsOptional()
  @IsString()
  paymentAlias?: string;

  @IsOptional()
  @IsBoolean()
  bookingAutoCancel?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  bookingAutoCancelHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveBookings?: number;

  @IsOptional()
  @IsString()
  waPublicBookingPhone?: string;

  @IsOptional()
  @IsBoolean()
  intakeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  depositEnabled?: boolean;
}
