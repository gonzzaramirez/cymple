import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum FinanceMovementScope {
  CENTER = 'CENTER',
  PROFESSIONAL = 'PROFESSIONAL',
}

export class CreateRevenueDto {
  @IsOptional()
  @IsEnum(FinanceMovementScope)
  scope?: FinanceMovementScope;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}
