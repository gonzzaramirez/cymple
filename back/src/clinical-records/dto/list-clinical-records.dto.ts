import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Max, Min } from 'class-validator';
import { NoteType } from '@prisma/client';

export class ListClinicalRecordsDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(NoteType)
  recordType?: NoteType;
}
