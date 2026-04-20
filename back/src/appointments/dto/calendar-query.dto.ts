import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class CalendarQueryDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  view?: 'day' | 'week' | 'month' = 'week';

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    const raw = Array.isArray(value) ? value : [value];
    return raw.flatMap((v: string) =>
      String(v)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  })
  @IsEnum(AppointmentStatus, { each: true })
  status?: AppointmentStatus[];

  @IsOptional()
  @IsString()
  patientId?: string;
}
