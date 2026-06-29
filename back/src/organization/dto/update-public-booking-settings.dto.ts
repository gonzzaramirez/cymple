import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpdatePublicBookingSettingsDto {
  @IsOptional()
  @IsBoolean()
  publicBookingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'publicBookingSlug solo puede contener letras minúsculas, números y guiones',
  })
  publicBookingSlug?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  depositWindowHours?: number;

  @IsOptional()
  @IsBoolean()
  bookingAutoCancel?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  bookingAutoCancelHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActiveBookings?: number;

  @IsOptional()
  @IsString()
  waPublicBookingPhone?: string;
}
