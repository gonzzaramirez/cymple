import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertAppointmentReasonDto {
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  plainTextPreview?: string;
}
