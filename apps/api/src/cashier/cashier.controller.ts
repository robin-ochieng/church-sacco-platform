import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CashierService } from './cashier.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { FilterDepositsDto } from './dto/filter-deposits.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/types';

@ApiTags('Cashier')
@ApiBearerAuth('JWT-auth')
@Controller('cashier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLERK, UserRole.TREASURER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SECRETARY)
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  @Post('deposits')
  @ApiOperation({ summary: 'Record a manual deposit for a member' })
  async createDeposit(@Body() dto: CreateDepositDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cashierService.createDeposit(dto, user);
  }

  @Get('deposits/:id')
  @ApiOperation({ summary: 'Fetch a single cashier deposit with receipt number' })
  async getDeposit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cashierService.getDeposit(id, user);
  }

  @Get('deposits')
  @ApiOperation({ summary: 'List recent deposits for your branch' })
  async listDeposits(@Query() filters: FilterDepositsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cashierService.listDeposits(filters, user);
  }
}
