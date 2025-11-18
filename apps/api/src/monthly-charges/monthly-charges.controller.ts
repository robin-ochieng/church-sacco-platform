import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MonthlyChargesService } from './monthly-charges.service';

@ApiTags('Monthly Charges')
@Controller('admin/monthly-charges')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MonthlyChargesController {
  constructor(private readonly monthlyChargesService: MonthlyChargesService) {}

  @Post('run')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TREASURER)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ 
    summary: 'Run monthly charges for a specific date range',
    description: 'Admin-only endpoint to manually trigger monthly charge processing for a given period'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (YYYY-MM-DD). Defaults to first day of current month' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (YYYY-MM-DD). Defaults to last day of current month' })
  @ApiResponse({
    status: 202,
    description: 'Monthly charges job scheduled successfully',
    schema: {
      properties: {
        jobId: { type: 'string' },
        status: { type: 'string', example: 'scheduled' },
        data: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            triggeredBy: { type: 'string' },
            manual: { type: 'boolean' },
          },
        },
      },
    },
  })
  async runMonthlyCharges(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
  ) {
    // Calculate date range if not provided
    let dateRange = { from, to };
    if (!from || !to) {
      dateRange = this.monthlyChargesService.calculateCurrentMonthRange();
    }

    const triggeredBy = req?.user?.email || req?.user?.sub || 'admin';

    const job = await this.monthlyChargesService.scheduleMonthlyCharges({
      from: dateRange.from as string,
      to: dateRange.to as string,
      triggeredBy,
      manual: true,
    });

    return {
      message: 'Monthly charges job scheduled successfully',
      ...job,
    };
  }

  @Get('status/:jobId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TREASURER)
  @ApiOperation({ 
    summary: 'Get monthly charges job status',
    description: 'Check the status and result of a monthly charges job'
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
  })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.monthlyChargesService.getJobStatus(jobId);
  }
}
