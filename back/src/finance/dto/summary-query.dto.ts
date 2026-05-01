import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FinanceMovementScope } from './create-revenue.dto';

export class FinanceSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  month?: string;

  @IsOptional()
  @IsEnum(FinanceMovementScope)
  scope?: FinanceMovementScope;

  @IsOptional()
  @IsString()
  professionalId?: string;
}
