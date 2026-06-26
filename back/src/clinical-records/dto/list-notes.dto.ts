import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { NoteType } from '@prisma/client';

export class ListNotesDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(200)
  limit = 50;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsEnum(NoteType)
  recordType?: NoteType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
