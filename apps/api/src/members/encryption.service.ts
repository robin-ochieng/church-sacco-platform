import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service to encrypt/decrypt PII (Personally Identifiable Information)
 * Uses AES-256-GCM encryption with the PII_ENCRYPTION_KEY from environment
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('PII_ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      throw new Error(
        'PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
      );
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Encrypts sensitive data
   * @param plaintext - Data to encrypt
   * @returns Buffer - Encrypted data with IV and auth tag prepended
   */
  encrypt(plaintext: string): Buffer {
    try {
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(12);

      // Create cipher
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get auth tag (16 bytes for GCM)
      const authTag = cipher.getAuthTag();

      // Combine: IV (12) + authTag (16) + encrypted data
      return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
      this.logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts encrypted data
   * @param encryptedBuffer - Buffer containing IV + authTag + encrypted data
   * @returns string - Decrypted plaintext
   */
  decrypt(encryptedBuffer: Buffer): string {
    try {
      // Extract components
      const iv = encryptedBuffer.slice(0, 12);
      const authTag = encryptedBuffer.slice(12, 28);
      const encrypted = encryptedBuffer.slice(28);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypts data and returns the last 4 characters for searchability
   * @param plaintext - Data to encrypt
   * @returns Object with encrypted buffer and last 4 characters
   */
  encryptWithLast4(plaintext: string): {
    encrypted: Buffer;
    last4: string;
  } {
    const encrypted = this.encrypt(plaintext);
    const last4 = plaintext.slice(-4).padStart(4, '*');
    return { encrypted, last4 };
  }

  /**
   * Hash data using SHA-256 (for comparison, not reversible)
   * @param data - Data to hash
   * @returns string - Hex-encoded hash
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
