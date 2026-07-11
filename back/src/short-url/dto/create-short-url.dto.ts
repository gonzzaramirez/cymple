import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateShortUrlDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  originalUrl!: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}
