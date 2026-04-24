import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ChangeAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
