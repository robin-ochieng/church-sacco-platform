import { Controller, Get, Header, Param, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { StatementQueryDto } from '../members/dto';
import { ReceiptsService } from './receipts.service';

const CASHIER_ROLES = [
  UserRole.CLERK,
  UserRole.TREASURER,
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.SECRETARY,
  UserRole.CHAIRMAN,
];
const STATEMENT_ROLES = [...CASHIER_ROLES, UserRole.MEMBER];

@ApiTags('Receipts')
@Controller()
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get('receipts/transaction/:receiptNumber.pdf')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Download teller receipt PDF by receipt number' })
  @ApiParam({ name: 'receiptNumber', description: 'Receipt number issued during deposit' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CASHIER_ROLES)
  @Header('Content-Type', 'application/pdf')
  async downloadTransactionReceipt(@Param('receiptNumber') receiptNumber: string) {
    const pdf = await this.receiptsService.generateTransactionReceiptPdf(receiptNumber);
    return new StreamableFile(pdf.buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${pdf.filename}"`,
      length: pdf.buffer.length,
    });
  }

  @Get('receipts/statement/:memberId.pdf')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Download member statement PDF' })
  @ApiParam({ name: 'memberId', description: 'Member UUID' })
  @ApiQuery({ name: 's', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'e', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'type', required: false, description: 'Transaction type filter' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STATEMENT_ROLES)
  @Header('Content-Type', 'application/pdf')
  async downloadStatementReceipt(
    @Param('memberId') memberId: string,
    @Query() query: StatementQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.receiptsService.assertStatementAccess(memberId, user);
    const pdf = await this.receiptsService.generateStatementPdf(memberId, query);
    return new StreamableFile(pdf.buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${pdf.filename}"`,
      length: pdf.buffer.length,
    });
  }

  @Get('verify/receipt/:receiptNumber')
  @ApiOperation({ summary: 'Verify authenticity of a teller receipt' })
  @ApiParam({ name: 'receiptNumber', description: 'Receipt number to verify' })
  async verifyReceipt(@Param('receiptNumber') receiptNumber: string) {
    return this.receiptsService.verifyReceipt(receiptNumber);
  }
}
