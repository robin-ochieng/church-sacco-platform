import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SignedUploadUrlResponse {
  signedUrl: string;
  token: string;
  path: string;
  expiresIn: number;
}

export interface UploadUrlOptions {
  userId: string;
  fileName: string;
  contentType?: string;
  maxFileSizeBytes?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly KYC_BUCKET = 'kyc';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  private readonly SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Generate a signed URL for uploading a file to the KYC bucket
   * Files are organized by user ID: kyc/{userId}/{timestamp}_{filename}
   */
  async generateSignedUploadUrl(
    options: UploadUrlOptions
  ): Promise<SignedUploadUrlResponse> {
    const { userId, fileName, contentType, maxFileSizeBytes } = options;

    // Validate content type
    if (contentType && !this.ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    // Validate file size
    const maxSize = maxFileSizeBytes || this.MAX_FILE_SIZE;
    if (maxSize > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Maximum file size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;

    try {
      const client = this.supabaseService.getAdminClient();

      // Create a signed upload URL
      const { data, error } = await client.storage
        .from(this.KYC_BUCKET)
        .createSignedUploadUrl(filePath);

      if (error) {
        this.logger.error(`Failed to generate signed upload URL: ${error.message}`);
        throw new BadRequestException('Failed to generate upload URL');
      }

      if (!data) {
        throw new BadRequestException('No upload URL generated');
      }

      this.logger.log(`Generated signed upload URL for user ${userId}: ${filePath}`);

      return {
        signedUrl: data.signedUrl,
        token: data.token,
        path: filePath,
        expiresIn: this.SIGNED_URL_EXPIRY,
      };
    } catch (error) {
      this.logger.error('Error generating signed upload URL:', error);
      throw error;
    }
  }

  /**
   * Get a signed URL for downloading a file from the KYC bucket
   */
  async generateSignedDownloadUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const client = this.supabaseService.getAdminClient();

      const { data, error } = await client.storage
        .from(this.KYC_BUCKET)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        this.logger.error(`Failed to generate signed download URL: ${error.message}`);
        throw new BadRequestException('Failed to generate download URL');
      }

      if (!data?.signedUrl) {
        throw new BadRequestException('No download URL generated');
      }

      return data.signedUrl;
    } catch (error) {
      this.logger.error('Error generating signed download URL:', error);
      throw error;
    }
  }

  /**
   * List files for a specific user in the KYC bucket
   */
  async listUserFiles(userId: string): Promise<any[]> {
    try {
      const client = this.supabaseService.getAdminClient();

      const { data, error } = await client.storage
        .from(this.KYC_BUCKET)
        .list(userId);

      if (error) {
        this.logger.error(`Failed to list files for user ${userId}: ${error.message}`);
        throw new BadRequestException('Failed to list files');
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error listing user files:', error);
      throw error;
    }
  }

  /**
   * Delete a file from the KYC bucket
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const client = this.supabaseService.getAdminClient();

      const { error } = await client.storage
        .from(this.KYC_BUCKET)
        .remove([filePath]);

      if (error) {
        this.logger.error(`Failed to delete file ${filePath}: ${error.message}`);
        throw new BadRequestException('Failed to delete file');
      }

      this.logger.log(`Deleted file: ${filePath}`);
    } catch (error) {
      this.logger.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Sanitize file name to prevent path traversal and other security issues
   */
  private sanitizeFileName(fileName: string): string {
    // Remove any path separators and special characters
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.+/g, '.')
      .substring(0, 100); // Limit length
  }

  /**
   * Check if a file exists in the KYC bucket
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const client = this.supabaseService.getAdminClient();

      const { data, error } = await client.storage
        .from(this.KYC_BUCKET)
        .list(filePath.split('/')[0], {
          search: filePath.split('/').pop(),
        });

      if (error) {
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      this.logger.error('Error checking file existence:', error);
      return false;
    }
  }
}
