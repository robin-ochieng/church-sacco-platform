import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveLoanDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
