import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SignedUploadUrlResponse, StorageService } from './storage.service';

class GenerateUploadUrlDto {
  fileName: string;
  contentType?: string;
  maxFileSizeBytes?: number;
}

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('kyc/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a signed URL for uploading KYC documents' })
  @ApiResponse({
    status: 200,
    description: 'Signed upload URL generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateUploadUrl(
    @Body() dto: GenerateUploadUrlDto,
    @Request() req: any
  ): Promise<SignedUploadUrlResponse> {
    const userId = req.user.sub || req.user.id;

    return this.storageService.generateSignedUploadUrl({
      userId,
      fileName: dto.fileName,
      contentType: dto.contentType,
      maxFileSizeBytes: dto.maxFileSizeBytes,
    });
  }

  @Get('kyc/files')
  @ApiOperation({ summary: 'List KYC files for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listFiles(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.storageService.listUserFiles(userId);
  }

  @Get('kyc/download-url/:filePath')
  @ApiOperation({ summary: 'Generate a signed URL for downloading a KYC document' })
  @ApiResponse({ status: 200, description: 'Signed download URL generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateDownloadUrl(
    @Param('filePath') filePath: string,
    @Request() req: any
  ): Promise<{ signedUrl: string }> {
    const userId = req.user.sub || req.user.id;

    // Ensure user can only access their own files
    if (!filePath.startsWith(`${userId}/`)) {
      filePath = `${userId}/${filePath}`;
    }

    const signedUrl = await this.storageService.generateSignedDownloadUrl(filePath);
    return { signedUrl };
  }

  @Delete('kyc/:filePath')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a KYC document' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteFile(@Param('filePath') filePath: string, @Request() req: any) {
    const userId = req.user.sub || req.user.id;

    // Ensure user can only delete their own files
    if (!filePath.startsWith(`${userId}/`)) {
      filePath = `${userId}/${filePath}`;
    }

    await this.storageService.deleteFile(filePath);
  }
}
