import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateProfessionalSettingsDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(15)
  @Max(60)
  consultationMinutes?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(30)
  bufferMinutes?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(72)
  minRescheduleHours?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  standardFee?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(72)
  reminderHours?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : value,
  )
  @IsBoolean()
  dailyDigestEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'dailyDigestTime debe tener formato HH:MM' })
  dailyDigestTime?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : Number(value)))
  @IsInt()
  @Min(1)
  @Max(72)
  autoConfirmHours?: number | null;

  @IsOptional()
  @IsString()
  paymentAlias?: string;
}
