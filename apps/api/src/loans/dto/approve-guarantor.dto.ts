import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum GuarantorApprovalAction {
  APPROVE = 'APPROVE',
  DECLINE = 'DECLINE',
}

export class ApproveGuarantorDto {
  @IsEnum(GuarantorApprovalAction)
  action: GuarantorApprovalAction;

  @IsString()
  @IsOptional()
  signatureKey?: string; // Supabase Storage key for uploaded signature

  @IsString()
  @IsOptional()
  declineReason?: string; // Required if action is DECLINE
}
