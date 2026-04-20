import { AppointmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}
