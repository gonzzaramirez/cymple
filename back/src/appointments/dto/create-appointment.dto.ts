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
import { AppointmentModality, PaymentMethod } from '@prisma/client';

export class CreateAppointmentDto {
  @IsString()
  patientId!: string;

  // Required when CENTER_ADMIN creates an appointment on behalf of a professional
  @IsOptional()
  @IsString()
  professionalId?: string;

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

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
