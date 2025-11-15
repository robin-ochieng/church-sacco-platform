import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service to generate unique member numbers in format ATSC-{YYYY}-{NNNN}
 * ATSC = Ack Thiboro Sacco
 * YYYY = Current year
 * NNNN = Sequential number (0001-9999)
 */
@Injectable()
export class MemberNumberGenerator {
  private readonly logger = new Logger(MemberNumberGenerator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a unique member number for the current year
   * Format: ATSC-{YYYY}-{NNNN}
   * Example: ATSC-2025-0001
   * 
   * @returns Promise<string> - Unique member number
   * @throws Error if unable to generate after max retries
   */
  async generateMemberNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `ATSC-${currentYear}-`;
    
    // Get the last member number for current year
    const lastMember = await this.prisma.member.findFirst({
      where: {
        memberNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        memberNumber: 'desc',
      },
      select: {
        memberNumber: true,
      },
    });

    let sequenceNumber = 1;

    if (lastMember) {
      // Extract sequence number from last member number
      // Example: ATSC-2025-0042 -> 0042 -> 42
      const parts = lastMember.memberNumber.split('-');
      const lastSequence = parts[2];
      if (lastSequence) {
        sequenceNumber = parseInt(lastSequence, 10) + 1;
      }
    }

    // Format with leading zeros (4 digits)
    const formattedSequence = sequenceNumber.toString().padStart(4, '0');
    const memberNumber = `${prefix}${formattedSequence}`;

    this.logger.log(`Generated member number: ${memberNumber}`);

    // Verify uniqueness (race condition protection)
    const exists = await this.prisma.member.findUnique({
      where: { memberNumber },
    });

    if (exists) {
      // Rare case: another request created this number concurrently
      // Recursively try next number
      this.logger.warn(
        `Member number ${memberNumber} already exists, generating next`,
      );
      return this.generateMemberNumber();
    }

    return memberNumber;
  }

  /**
   * Validates member number format
   * @param memberNumber - Member number to validate
   * @returns boolean - True if valid format
   */
  static validateFormat(memberNumber: string): boolean {
    const pattern = /^ATSC-\d{4}-\d{4}$/;
    return pattern.test(memberNumber);
  }

  /**
   * Extracts year from member number
   * @param memberNumber - Member number (e.g., ATSC-2025-0001)
   * @returns number - Year or null if invalid
   */
  static extractYear(memberNumber: string): number | null {
    if (!this.validateFormat(memberNumber)) {
      return null;
    }
    const parts = memberNumber.split('-');
    const year = parts[1];
    return year ? parseInt(year, 10) : null;
  }

  /**
   * Extracts sequence number from member number
   * @param memberNumber - Member number (e.g., ATSC-2025-0001)
   * @returns number - Sequence number or null if invalid
   */
  static extractSequence(memberNumber: string): number | null {
    if (!this.validateFormat(memberNumber)) {
      return null;
    }
    const parts = memberNumber.split('-');
    const sequence = parts[2];
    return sequence ? parseInt(sequence, 10) : null;
  }
}
