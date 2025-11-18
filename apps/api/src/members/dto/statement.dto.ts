import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class StatementQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for statement period (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  s?: string;

  @ApiPropertyOptional({
    description: 'End date for statement period (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  e?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: ['SAVINGS_DEPOSIT', 'SHARES_DEPOSIT', 'SPECIAL_CONTRIBUTION', 'MAINTENANCE_FEE', 'WITHDRAWAL', 'ADJUSTMENT'],
  })
  @IsOptional()
  @IsEnum(['SAVINGS_DEPOSIT', 'SHARES_DEPOSIT', 'SPECIAL_CONTRIBUTION', 'MAINTENANCE_FEE', 'WITHDRAWAL', 'ADJUSTMENT'])
  type?: string;
}

export class LedgerEntryDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'cm123abc456',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction date',
    example: '2024-01-15T10:30:00Z',
  })
  date: Date;

  @ApiProperty({
    description: 'Transaction type',
    example: 'SAVINGS_DEPOSIT',
    enum: ['SAVINGS_DEPOSIT', 'SHARES_DEPOSIT', 'SPECIAL_CONTRIBUTION', 'MAINTENANCE_FEE', 'WITHDRAWAL', 'ADJUSTMENT'],
  })
  type: string;

  @ApiProperty({
    description: 'Payment channel',
    example: 'CASH',
    enum: ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE'],
  })
  channel: string;

  @ApiProperty({
    description: 'Transaction reference number',
    example: 'RKJ8X9P2QW',
    nullable: true,
  })
  reference: string | null;

  @ApiProperty({
    description: 'Transaction narration/description',
    example: 'Monthly savings deposit',
    nullable: true,
  })
  narration: string | null;

  @ApiProperty({
    description: 'Debit amount (withdrawals, charges)',
    example: 0,
  })
  debit: number;

  @ApiProperty({
    description: 'Credit amount (deposits)',
    example: 5000,
  })
  credit: number;

  @ApiProperty({
    description: 'Running balance after this transaction',
    example: 15000,
  })
  balance: number;

  @ApiProperty({
    description: 'Receipt number for deposits',
    example: 'RCP-2024-001234',
    nullable: true,
  })
  receiptNumber: string | null;

  @ApiProperty({
    description: 'Transaction status',
    example: 'POSTED',
    enum: ['PENDING', 'POSTED', 'REVERSED'],
  })
  status: string;

  @ApiProperty({
    description: 'Cashier/user who created the transaction',
    example: 'cm123xyz789',
    nullable: true,
  })
  cashierId: string | null;
}

export class StatementResponseDto {
  @ApiProperty({
    description: 'Member information',
  })
  member: {
    id: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiProperty({
    description: 'Statement period',
  })
  period: {
    startDate: string;
    endDate: string;
  };

  @ApiProperty({
    description: 'Opening balance at start of period',
    example: 10000,
  })
  openingBalance: number;

  @ApiProperty({
    description: 'Closing balance at end of period',
    example: 25000,
  })
  closingBalance: number;

  @ApiProperty({
    description: 'Total deposits in period',
    example: 20000,
  })
  totalDeposits: number;

  @ApiProperty({
    description: 'Total withdrawals in period',
    example: 5000,
  })
  totalWithdrawals: number;

  @ApiProperty({
    description: 'Ledger entries ordered by date ascending',
    type: [LedgerEntryDto],
  })
  transactions: LedgerEntryDto[];

  @ApiProperty({
    description: 'Number of transactions in statement',
    example: 15,
  })
  transactionCount: number;

  @ApiProperty({
    description: 'Statement generation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  generatedAt: Date;
}
