import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AppointmentStatus } from '@prisma/client';

export class ListAppointmentsDto extends PaginationQueryDto {
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @Transform(({ value }) => {
    if (value == null) return undefined;
    const raw = Array.isArray(value) ? value : [value];
    return raw.flatMap((v) =>
      String(v)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ) as unknown as AppointmentStatus[];
  })
  @IsEnum(AppointmentStatus, { each: true })
  status?: AppointmentStatus[];

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  // Filter by professional (CENTER_ADMIN only)
  @IsOptional()
  @IsString()
  professionalId?: string;
}
