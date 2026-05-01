import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import { FinanceService } from './finance.service';
import { FinanceSummaryQueryDto } from './dto/summary-query.dto';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { FinanceListQueryDto } from './dto/list-finance.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  summary(@Req() req: Request, @Query() query: FinanceSummaryQueryDto) {
    return this.financeService.summary(buildAccessContext(req), query);
  }

  @Get('revenues')
  listRevenues(@Req() req: Request, @Query() query: FinanceListQueryDto) {
    return this.financeService.listRevenues(buildAccessContext(req), query);
  }

  @Post('revenues')
  createRevenue(@Req() req: Request, @Body() dto: CreateRevenueDto) {
    return this.financeService.createRevenue(buildAccessContext(req), dto);
  }

  @Patch('revenues/:id')
  updateRevenue(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRevenueDto,
  ) {
    return this.financeService.updateRevenue(buildAccessContext(req), id, dto);
  }

  @Get('expenses')
  listExpenses(@Req() req: Request, @Query() query: FinanceListQueryDto) {
    return this.financeService.listExpenses(buildAccessContext(req), query);
  }

  @Post('expenses')
  createExpense(@Req() req: Request, @Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(buildAccessContext(req), dto);
  }

  @Patch('expenses/:id')
  updateExpense(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(buildAccessContext(req), id, dto);
  }

  @Delete('expenses/:id')
  removeExpense(@Req() req: Request, @Param('id') id: string) {
    return this.financeService.removeExpense(buildAccessContext(req), id);
  }
}
