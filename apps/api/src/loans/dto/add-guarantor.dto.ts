import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class AddGuarantorDto {
  @IsUUID()
  @IsNotEmpty()
  guarantorMemberId: string;

  @IsNumber()
  @Min(1, { message: 'Amount guaranteed must be at least 1' })
  amountGuaranteed: number;
}
