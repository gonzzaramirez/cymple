import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bodyV2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bodyV3?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
