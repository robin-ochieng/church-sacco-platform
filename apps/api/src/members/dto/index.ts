import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  memberNumber: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  idPassportNumber: string;

  @IsString()
  physicalAddress: string;

  @IsString()
  @IsOptional()
  poBox?: string;

  @IsString()
  telephone: string;

  @IsString()
  @IsOptional()
  telephoneAlt?: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  employerName?: string;

  @IsString()
  @IsOptional()
  employerAddress?: string;

  @IsString()
  @IsOptional()
  passportPhotoUrl?: string;

  // Referee details
  @IsString()
  @IsOptional()
  refereeName?: string;

  @IsString()
  @IsOptional()
  refereePhone?: string;

  // Next of Kin (primary)
  @IsString()
  nextOfKinName: string;

  @IsString()
  nextOfKinPhone: string;

  @IsString()
  nextOfKinRelationship: string;

  // Beneficiaries
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiaryDto)
  @IsOptional()
  beneficiaries?: BeneficiaryDto[];

  // Witness details
  @IsString()
  @IsOptional()
  witnessName?: string;

  @IsDateString()
  @IsOptional()
  witnessDate?: string;

  // Registration
  @IsNumber()
  @Min(0)
  @IsOptional()
  registrationFee?: number;

  @IsBoolean()
  @IsOptional()
  agreedToTerms?: boolean;

  @IsBoolean()
  @IsOptional()
  agreedToRefundPolicy?: boolean;
}

export class BeneficiaryDto {
  @IsString()
  fullName: string;

  @IsInt()
  @IsOptional()
  age?: number;

  @IsString()
  relationship: string;
}

export class UpdateMemberDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsOptional()
  physicalAddress?: string;

  @IsString()
  @IsOptional()
  poBox?: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsString()
  @IsOptional()
  telephoneAlt?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  employerName?: string;

  @IsString()
  @IsOptional()
  employerAddress?: string;

  @IsString()
  @IsOptional()
  passportPhotoUrl?: string;

  @IsString()
  @IsOptional()
  membershipStatus?: string;

  @IsBoolean()
  @IsOptional()
  agreedToTerms?: boolean;

  @IsBoolean()
  @IsOptional()
  agreedToRefundPolicy?: boolean;
}

export class MemberQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
