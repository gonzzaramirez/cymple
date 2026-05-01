import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FinanceMovementScope } from './create-revenue.dto';

export class FinanceListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FinanceMovementScope)
  scope?: FinanceMovementScope;

  @IsOptional()
  @IsString()
  professionalId?: string;
}
