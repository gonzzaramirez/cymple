import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import {
  PublicIntakeController,
  IntakeDashboardController,
} from './intake-form.controller';
import { IntakeFormService } from './intake-form.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicIntakeController, IntakeDashboardController],
  providers: [IntakeFormService],
  exports: [IntakeFormService],
})
export class IntakeFormModule {}
