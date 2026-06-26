import { IsArray, IsBoolean, IsDateString, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HabitsDto {
  @IsOptional()
  @IsBoolean()
  alcohol?: boolean;

  @IsOptional()
  @IsBoolean()
  cigarettes?: boolean;

  @IsOptional()
  @IsBoolean()
  drugs?: boolean;

  @IsOptional()
  @IsBoolean()
  coffee?: boolean;
}

export class VisibleCapillariesDto {
  @IsOptional()
  @IsBoolean()
  nose?: boolean;

  @IsOptional()
  @IsBoolean()
  cheeks?: boolean;

  @IsOptional()
  @IsBoolean()
  forehead?: boolean;

  @IsOptional()
  @IsBoolean()
  erythema?: boolean;

  @IsOptional()
  @IsBoolean()
  irritation?: boolean;

  @IsOptional()
  @IsBoolean()
  cuperosity?: boolean;
}

export class SebaceousConditionDto {
  @IsOptional()
  @IsBoolean()
  pustules?: boolean;

  @IsOptional()
  @IsBoolean()
  papules?: boolean;

  @IsOptional()
  @IsBoolean()
  hyperplasia?: boolean;

  @IsOptional()
  @IsBoolean()
  comedones?: boolean;

  @IsOptional()
  @IsBoolean()
  milium?: boolean;
}

export class PigmentationDto {
  @IsOptional()
  @IsBoolean()
  hyperpigmentation?: boolean;

  @IsOptional()
  @IsBoolean()
  hypopigmentation?: boolean;
}

export class HomeCareDto {
  @IsOptional()
  @IsBoolean()
  cleaning?: boolean;

  @IsOptional()
  @IsBoolean()
  exfoliation?: boolean;

  @IsOptional()
  @IsBoolean()
  moisturizers?: boolean;

  @IsOptional()
  @IsBoolean()
  hydratants?: boolean;

  @IsOptional()
  @IsBoolean()
  sunProtection?: boolean;

  @IsOptional()
  @IsBoolean()
  none?: boolean;
}

export class SubmitIntakeDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsDateString()
  birthDate: string;

  @IsOptional()
  @IsDateString()
  lastTreatmentDate?: string;

  @IsOptional()
  @IsString()
  avoidAreas?: string;

  @ValidateNested()
  @Type(() => HabitsDto)
  habits: HabitsDto;

  @ValidateNested()
  @Type(() => HomeCareDto)
  homeCare: HomeCareDto;

  @ValidateNested()
  @Type(() => VisibleCapillariesDto)
  visibleCapillaries: VisibleCapillariesDto;

  @ValidateNested()
  @Type(() => SebaceousConditionDto)
  sebaceousCondition: SebaceousConditionDto;

  @ValidateNested()
  @Type(() => PigmentationDto)
  pigmentation: PigmentationDto;
}
