import { IsInt, IsMilitaryTime, IsOptional, Min } from 'class-validator';

export class AvailabilityRangeDto {
  @IsMilitaryTime()
  startTime!: string;

  @IsMilitaryTime()
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
