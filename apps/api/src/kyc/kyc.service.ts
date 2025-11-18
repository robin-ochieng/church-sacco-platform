import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUploadUrlDto, UploadUrlResponseDto } from './dto';

@Injectable()
export class KycService {
  private readonly KYC_BUCKET = 'kyc';
  private readonly URL_EXPIRY_SECONDS = 3600; // 1 hour

  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate a signed upload URL for KYC document
   * @param memberId - Member ID
   * @param dto - Upload URL request
   * @param requestingUserId - ID of user making the request
   * @param userRole - Role of requesting user
   * @returns Signed upload URL and file path
   */
  async generateUploadUrl(
    memberId: string,
    dto: RequestUploadUrlDto,
    requestingUserId: string,
    userRole: string,
  ): Promise<UploadUrlResponseDto> {
    // Verify member exists
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    // Authorization check: only same member or clerk/manager can request
    const isOwnMember = member.userId === requestingUserId;
    const isAuthorized = isOwnMember || ['clerk', 'manager', 'admin'].includes(userRole.toLowerCase());

    if (!isAuthorized) {
      throw new ForbiddenException('You are not authorized to upload KYC documents for this member');
    }

    // Generate unique file path: kyc/{memberId}/{documentType}_{timestamp}.{extension}
    const timestamp = Date.now();
    const fileName = `${dto.documentType}_${timestamp}.${dto.fileExtension}`;
    const filePath = `${memberId}/${fileName}`;

    // Get Supabase client
    const supabaseClient = this.supabase.getClient();

    // Create signed upload URL
    const { data, error } = await supabaseClient.storage
      .from(this.KYC_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }

    return {
      uploadUrl: data.signedUrl,
      filePath: `${this.KYC_BUCKET}/${filePath}`,
      expiresIn: this.URL_EXPIRY_SECONDS,
    };
  }

  /**
   * Get signed download URL for a KYC document
   * @param memberId - Member ID
   * @param filePath - File path in storage
   * @param requestingUserId - ID of user making the request
   * @param userRole - Role of requesting user
   * @returns Signed download URL
   */
  async getDownloadUrl(
    memberId: string,
    filePath: string,
    requestingUserId: string,
    userRole: string,
  ): Promise<string> {
    // Verify member exists
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    // Authorization check
    const isOwnMember = member.userId === requestingUserId;
    const isAuthorized = isOwnMember || ['clerk', 'manager', 'admin'].includes(userRole.toLowerCase());

    if (!isAuthorized) {
      throw new ForbiddenException('You are not authorized to access KYC documents for this member');
    }

    // Get Supabase client
    const supabaseClient = this.supabase.getClient();

    // Create signed download URL
    const { data, error } = await supabaseClient.storage
      .from(this.KYC_BUCKET)
      .createSignedUrl(filePath, this.URL_EXPIRY_SECONDS);

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * List all KYC documents for a member
   * @param memberId - Member ID
   * @returns List of file paths
   */
  async listMemberDocuments(memberId: string): Promise<string[]> {
    // Verify member exists
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    // Get Supabase client
    const supabaseClient = this.supabase.getClient();

    // List files in member's folder
    const { data, error } = await supabaseClient.storage
      .from(this.KYC_BUCKET)
      .list(memberId);

    if (error) {
      throw new Error(`Failed to list documents: ${error.message}`);
    }

    return data.map((file) => `${memberId}/${file.name}`);
  }
}
