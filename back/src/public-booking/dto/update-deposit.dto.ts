import { IsEnum } from 'class-validator';
import { DepositStatus } from '@prisma/client';

export class UpdateDepositDto {
  @IsEnum(DepositStatus)
  depositStatus!: DepositStatus;
}
