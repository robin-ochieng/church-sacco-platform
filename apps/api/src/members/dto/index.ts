import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEmail,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';

// Enums
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

// Registration DTO - matches P1.1 requirements
export class CreateMemberDto {
  // User credentials
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Personal Information (Step 1)
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;

  // E.164 phone format validation: +254XXXXXXXXX
  @IsString()
  @Matches(/^\+254\d{9}$/, { 
    message: 'Phone must be in E.164 format (e.g., +254712345678)' 
  })
  telephone: string;

  @IsEmail()
  @IsOptional()
  emailOptional?: string;

  // Address & Church Group (Step 2)
  @IsString()
  physicalAddress: string;

  @IsString()
  @IsOptional()
  poBox?: string;

  @IsString()
  @IsOptional()
  churchGroup?: string;

  // ID Number & Referee (Step 3)
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  idPassportNumber: string; // Will be encrypted as idNumberEncrypted

  @IsString()
  @IsOptional()
  @Matches(/^ATSC-\d{4}-\d{4}$/, {
    message: 'Referee member number must be in format ATSC-YYYY-NNNN'
  })
  refereeMemberNo?: string;

  // Optional fields
  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+254\d{9}$/, { 
    message: 'Alternative phone must be in E.164 format' 
  })
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

  // Referee details (additional)
  @IsString()
  @IsOptional()
  refereeName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+254\d{9}$/, { 
    message: 'Referee phone must be in E.164 format' 
  })
  refereePhone?: string;

  // Next of Kin (primary)
  @IsString()
  nextOfKinName: string;

  @IsString()
  @Matches(/^\+254\d{9}$/, { 
    message: 'Next of kin phone must be in E.164 format' 
  })
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

  // Backoffice fields (set by system)
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  verifiedBy?: string;

  @IsDateString()
  @IsOptional()
  verifiedAt?: string;
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

export * from './statement.dto';
