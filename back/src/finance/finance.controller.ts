import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { FinanceService } from './finance.service';
import { FinanceSummaryQueryDto } from './dto/summary-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  summary(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: FinanceSummaryQueryDto,
  ) {
    return this.financeService.summary(professionalId, query);
  }

  @Get('revenues')
  listRevenues(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financeService.listRevenues(professionalId, query);
  }

  @Post('revenues')
  createRevenue(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: CreateRevenueDto,
  ) {
    return this.financeService.createRevenue(professionalId, dto);
  }

  @Patch('revenues/:id')
  updateRevenue(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRevenueDto,
  ) {
    return this.financeService.updateRevenue(professionalId, id, dto);
  }

  @Get('expenses')
  listExpenses(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financeService.listExpenses(professionalId, query);
  }

  @Post('expenses')
  createExpense(
    @CurrentProfessionalId() professionalId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.financeService.createExpense(professionalId, dto);
  }

  @Patch('expenses/:id')
  updateExpense(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(professionalId, id, dto);
  }

  @Delete('expenses/:id')
  removeExpense(
    @CurrentProfessionalId() professionalId: string,
    @Param('id') id: string,
  ) {
    return this.financeService.removeExpense(professionalId, id);
  }
}
