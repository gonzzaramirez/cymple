import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { AvailabilityRangeDto } from './availability-range.dto';

export class SlotCapacityDto {
  @IsMilitaryTime()
  startTime!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class SpecificDateAvailabilityItemDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  ranges!: AvailabilityRangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotCapacityDto)
  slotCapacities?: SlotCapacityDto[];
}

export class UpsertSpecificDateAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecificDateAvailabilityItemDto)
  items!: SpecificDateAvailabilityItemDto[];
}
