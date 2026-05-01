import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { FinanceMovementScope } from './create-revenue.dto';

export class CreateExpenseDto {
  @IsOptional()
  @IsEnum(FinanceMovementScope)
  scope?: FinanceMovementScope;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsString()
  @MaxLength(200)
  concept!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsDateString()
  occurredAt!: string;
}
