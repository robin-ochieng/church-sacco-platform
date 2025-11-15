import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KycService } from './kyc.service';
import { RequestUploadUrlDto, UploadUrlResponseDto } from './dto';

@ApiTags('KYC')
@Controller('members/:memberId/kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request signed upload URL for KYC document',
    description: 'Generates a signed URL for uploading KYC documents (ID front/back, selfie, photo). Only the member themselves or clerk/manager/admin can request.',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Member ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed upload URL generated successfully',
    type: UploadUrlResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not authorized to upload for this member',
  })
  @ApiResponse({
    status: 404,
    description: 'Member not found',
  })
  async requestUploadUrl(
    @Param('memberId') memberId: string,
    @Body() dto: RequestUploadUrlDto,
    @Request() req: any,
  ): Promise<UploadUrlResponseDto> {
    const requestingUserId = req.user.sub; // From JWT
    const userRole = req.user.role || 'member'; // From JWT

    return this.kycService.generateUploadUrl(
      memberId,
      dto,
      requestingUserId,
      userRole,
    );
  }

  @Get('documents')
  @ApiOperation({
    summary: 'List all KYC documents for a member',
    description: 'Returns list of all uploaded KYC documents',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Member ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of document paths',
    type: [String],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Member not found',
  })
  async listDocuments(
    @Param('memberId') memberId: string,
  ): Promise<string[]> {
    return this.kycService.listMemberDocuments(memberId);
  }
}
