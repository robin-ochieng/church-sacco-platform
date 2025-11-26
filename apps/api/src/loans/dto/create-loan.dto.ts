import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum DisbursementMode {
  NET = 'NET',
  GROSS = 'GROSS',
}

export class CreateLoanDto {
  @IsUUID()
  memberId: string;

  @IsNumber()
  @Min(1000)
  loanAmount: number;

  @IsString()
  purpose: string;

  @IsNumber()
  @Min(1)
  @Max(60)
  repaymentMonths: number;

  @IsNumber()
  @Min(0)
  monthlyIncome: number;

  @IsString()
  sourceIncome: string;

  @IsOptional()
  @IsEnum(DisbursementMode)
  disbursementMode?: DisbursementMode;
}
