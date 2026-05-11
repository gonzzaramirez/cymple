import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClinicalRecordDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  plainTextPreview?: string;
}
