import { IsDateString } from 'class-validator';

export class SlotsQueryDto {
  @IsDateString()
  date!: string;
}
