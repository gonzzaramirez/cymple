import { IsDateString, IsOptional } from 'class-validator';

export class FinanceSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  month?: string;
}
