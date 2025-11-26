import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class DisburseLoanDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  arrearsDeducted?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  savingsDeducted?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sharesDeducted?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
