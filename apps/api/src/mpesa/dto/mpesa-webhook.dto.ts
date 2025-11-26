import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class MpesaWebhookDto {
  @ApiProperty({
    description: 'M-Pesa transaction reference (e.g., SAF12345XYZ)',
    example: 'SAF12345XYZ',
  })
  @IsString()
  TransID: string;

  @ApiProperty({
    description: 'Phone number that sent the money (format: 2547XXXXXXXX)',
    example: '254712345678',
  })
  @IsString()
  MSISDN: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 1000,
  })
  @IsNumber()
  TransAmount: number;

  @ApiProperty({
    description: 'Business short code receiving the payment',
    example: '600000',
  })
  @IsString()
  BusinessShortCode: string;

  @ApiProperty({
    description: 'Bill reference number (Account number)',
    example: 'ATSC-2025-0001',
    required: false,
  })
  @IsOptional()
  @IsString()
  BillRefNumber?: string;

  @ApiProperty({
    description: 'Transaction type (e.g., "Paybill")',
    example: 'Paybill',
  })
  @IsString()
  TransactionType: string;

  @ApiProperty({
    description: 'Transaction time (format: YYYYMMDDHHMMSS)',
    example: '20251120123045',
  })
  @IsString()
  TransTime: string;

  @ApiProperty({
    description: 'First name of sender',
    example: 'JOHN',
    required: false,
  })
  @IsOptional()
  @IsString()
  FirstName?: string;

  @ApiProperty({
    description: 'Middle name of sender',
    example: 'DOE',
    required: false,
  })
  @IsOptional()
  @IsString()
  MiddleName?: string;

  @ApiProperty({
    description: 'Last name of sender',
    example: 'SMITH',
    required: false,
  })
  @IsOptional()
  @IsString()
  LastName?: string;

  @ApiProperty({
    description: 'Organization balance after transaction',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  OrgAccountBalance?: number;
}

export class MpesaWebhookResponseDto {
  @ApiProperty({
    description: 'Result code (0 for success)',
    example: 0,
  })
  ResultCode: number;

  @ApiProperty({
    description: 'Result description',
    example: 'Success',
  })
  ResultDesc: string;
}
