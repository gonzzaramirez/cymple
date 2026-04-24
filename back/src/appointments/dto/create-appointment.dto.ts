import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AppointmentModality } from '@prisma/client';

export class CreateAppointmentDto {
  @IsString()
  patientId!: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(15)
  @Max(180)
  durationMinutes?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(AppointmentModality)
  modality?: AppointmentModality;
}
