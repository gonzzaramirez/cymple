import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SearchPatientsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
