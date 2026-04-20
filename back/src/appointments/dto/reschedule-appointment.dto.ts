import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
