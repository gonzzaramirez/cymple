import { Module } from '@nestjs/common';
import { ClinicalRecordsModule } from '../clinical-records/clinical-records.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [ClinicalRecordsModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
