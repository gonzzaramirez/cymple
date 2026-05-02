import { IsOptional, IsString, Matches } from 'class-validator';

export class SlotsQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(T.*)?$/, {
    message: 'date must be a valid date string (yyyy-MM-dd or ISO 8601)',
  })
  date!: string;

  @IsString()
  @IsOptional()
  professionalId?: string;
}
