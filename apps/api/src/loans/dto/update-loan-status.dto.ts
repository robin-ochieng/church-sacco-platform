import { LoanStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateLoanStatusDto {
  @IsEnum(LoanStatus)
  status: LoanStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
