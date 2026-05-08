import { Module } from '@nestjs/common';
import { ClinicalRecordsController } from './clinical-records.controller';
import { ClinicalRecordsService } from './clinical-records.service';
import { ClinicalNotesQueryService } from './clinical-notes-query.service';

@Module({
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService, ClinicalNotesQueryService],
  exports: [ClinicalRecordsService, ClinicalNotesQueryService],
})
export class ClinicalRecordsModule {}
