import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Weekday } from '@prisma/client';
import { AvailabilityRangeDto } from './availability-range.dto';

export class WeeklyAvailabilityItemDto {
  @IsEnum(Weekday)
  weekday!: Weekday;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRangeDto)
  ranges!: AvailabilityRangeDto[];
}

export class UpsertWeeklyAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyAvailabilityItemDto)
  items!: WeeklyAvailabilityItemDto[];
}
