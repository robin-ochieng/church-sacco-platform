import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { UpdateLoanStatusDto } from './dto/update-loan-status.dto';
import { LoanScheduleService } from './loan-schedule.service';
import { LoansService } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly loanScheduleService: LoanScheduleService,
  ) {}

  @Post()
  create(@Body() createLoanDto: CreateLoanDto) {
    return this.loansService.create(createLoanDto);
  }

  @Get()
  findAll(@Query('status') status?: LoanStatus) {
    return this.loansService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateLoanStatusDto: UpdateLoanStatusDto,
  ) {
    return this.loansService.updateStatus(id, updateLoanStatusDto);
  }

  /**
   * POST /loans/:id/approve
   * Approve a loan - requires chairman/secretary/treasurer role
   */
  @Post(':id/approve')
  approveLoan(
    @Param('id') id: string,
    @Body() dto: ApproveLoanDto,
    @Headers('x-user-id') userId: string, // TODO: Replace with proper auth decorator
  ) {
    // In production, get userId from JWT token via auth guard
    const approverId = userId || 'system';
    return this.loansService.approveLoan(id, approverId, dto);
  }

  /**
   * POST /loans/:id/disburse
   * Disburse an approved loan with deduction calculations
   */
  @Post(':id/disburse')
  disburseLoan(
    @Param('id') id: string,
    @Body() dto: DisburseLoanDto,
    @Headers('x-user-id') userId: string, // TODO: Replace with proper auth decorator
  ) {
    // In production, get userId from JWT token via auth guard
    const disburserId = userId || 'system';
    return this.loansService.disburseLoan(id, disburserId, dto);
  }

  /**
   * GET /loans/:id/schedule
   * Get the loan repayment schedule (amortization table)
   */
  @Get(':id/schedule')
  getSchedule(@Param('id') id: string) {
    return this.loanScheduleService.getScheduleWithDetails(id);
  }

  /**
   * GET /loans/:id/schedule/summary
   * Get schedule summary for dashboard
   */
  @Get(':id/schedule/summary')
  getScheduleSummary(@Param('id') id: string) {
    return this.loanScheduleService.getScheduleSummary(id);
  }

  /**
   * POST /loans/:id/schedule/generate
   * Generate repayment schedule for an approved loan
   */
  @Post(':id/schedule/generate')
  generateSchedule(@Param('id') id: string) {
    return this.loanScheduleService.generateSchedule(id);
  }

  /**
   * GET /loans/:id/full
   * Get loan with all related data including schedule
   */
  @Get(':id/full')
  findOneWithSchedule(@Param('id') id: string) {
    return this.loansService.findOneWithSchedule(id);
  }
}
