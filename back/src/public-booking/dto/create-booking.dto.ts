import { IsString, Matches, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  professionalSlug: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'slotDate debe tener formato YYYY-MM-DD',
  })
  slotDate: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'slotStart debe tener formato HH:mm',
  })
  slotStart: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'slotEnd debe tener formato HH:mm',
  })
  slotEnd: string;

  @IsString()
  @MinLength(2)
  patientName: string;

  @IsString()
  @Matches(/^[\d\s\-+()]{7,20}$/, {
    message: 'patientPhone debe ser un número de teléfono válido',
  })
  patientPhone: string;
}
