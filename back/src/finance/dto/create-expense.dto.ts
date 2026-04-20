import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
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
