import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum KycDocumentType {
  ID_FRONT = 'id_front',
  ID_BACK = 'id_back',
  SELFIE = 'selfie',
  PHOTO = 'photo',
}

export class RequestUploadUrlDto {
  @ApiProperty({
    description: 'Type of KYC document to upload',
    enum: KycDocumentType,
    example: KycDocumentType.ID_FRONT,
  })
  @IsEnum(KycDocumentType)
  @IsNotEmpty()
  documentType: KycDocumentType;

  @ApiProperty({
    description: 'File extension (e.g., jpg, png, pdf)',
    example: 'jpg',
  })
  @IsString()
  @IsNotEmpty()
  fileExtension: string;
}

export class UploadUrlResponseDto {
  @ApiProperty({
    description: 'Signed URL for uploading the document',
    example: 'https://supabase.co/storage/v1/object/sign/kyc/...',
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'Path where the file will be stored',
    example: 'kyc/123e4567-e89b-12d3-a456-426614174000/id_front.jpg',
  })
  filePath: string;

  @ApiProperty({
    description: 'Expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}

export class KycDocumentDto {
  @ApiProperty({
    description: 'Document ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Member ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  memberId: string;

  @ApiProperty({
    enum: KycDocumentType,
  })
  documentType: KycDocumentType;

  @ApiProperty({
    description: 'Storage path of the document',
  })
  filePath: string;

  @ApiProperty({
    description: 'Upload timestamp',
  })
  uploadedAt: Date;

  @ApiProperty({
    description: 'Verification status',
    example: 'pending',
  })
  verificationStatus: string;
}
