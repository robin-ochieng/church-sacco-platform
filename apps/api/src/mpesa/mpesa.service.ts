import { Injectable, Logger } from '@nestjs/common';
import { MpesaMessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MpesaWebhookDto } from './dto/mpesa-webhook.dto';

interface WebhookProcessingResult {
  success: boolean;
  status: MpesaMessageStatus;
  mpesaMessageId: string;
  transactionId?: string | null;
  error?: string;
}

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Process M-Pesa C2B webhook payload
   * 1. Check for duplicate mpesaRef (idempotency)
   * 2. Store raw payload in mpesa_messages
   * 3. Attempt to match MSISDN to member
   * 4. Create transaction if match found
   * 5. Mark as suspense if ambiguous/no match
   */
  async processWebhook(payload: MpesaWebhookDto): Promise<WebhookProcessingResult> {
    const { TransID, MSISDN, TransAmount, BillRefNumber } = payload;

    this.logger.log(`Processing M-Pesa webhook: ${TransID} from ${MSISDN}`);

    try {
      // 1. Check for duplicate (idempotency)
      const existingMessage = await this.prisma.mpesaMessage.findUnique({
        where: { mpesaRef: TransID },
      });

      if (existingMessage) {
        this.logger.warn(`Duplicate M-Pesa ref detected: ${TransID}`);
        return {
          success: true,
          status: MpesaMessageStatus.DUPLICATE,
          mpesaMessageId: existingMessage.id,
          transactionId: existingMessage.matchedTxnId,
        };
      }

      // 2. Normalize phone number (remove country code prefix if present)
      const normalizedPhone = this.normalizePhoneNumber(MSISDN);

      // 3. Attempt to find matching member(s) by phone
      const matchingMembers = await this.findMembersByPhone(normalizedPhone);

      let status: MpesaMessageStatus;
      let matchedTxnId: string | null = null;

      // 4. Process based on match result
      if (matchingMembers.length === 0) {
        // No match found - mark as suspense
        this.logger.warn(`No member found for phone: ${normalizedPhone}`);
        status = MpesaMessageStatus.SUSPENSE;
      } else if (matchingMembers.length > 1) {
        // Multiple matches - ambiguous, mark as suspense
        this.logger.warn(
          `Multiple members found for phone ${normalizedPhone}: ${matchingMembers.map((m) => m.memberNumber).join(', ')}`,
        );
        status = MpesaMessageStatus.SUSPENSE;
      } else {
        // Single match - create transaction
        const member = matchingMembers[0];
        if (member) {
          this.logger.log(`Matched member: ${member.memberNumber}`);

          try {
            const transaction = await this.createDepositTransaction(
              member.id,
              TransAmount,
              TransID,
              BillRefNumber,
            );
            matchedTxnId = transaction.id;
            status = MpesaMessageStatus.MATCHED;
            this.logger.log(`Transaction created: ${transaction.receiptNumber}`);
          } catch (error: any) {
            this.logger.error(`Failed to create transaction: ${error.message}`);
            status = MpesaMessageStatus.SUSPENSE;
          }
        } else {
           status = MpesaMessageStatus.SUSPENSE;
        }
      }

      // 5. Store M-Pesa message in database
      const mpesaMessage = await this.prisma.mpesaMessage.create({
        data: {
          mpesaRef: TransID,
          msisdn: MSISDN,
          amount: new Prisma.Decimal(TransAmount),
          narrative: this.buildNarrative(payload),
          rawJson: payload as any,
          matchedTxnId,
          status,
        },
      });

      return {
        success: true,
        status,
        mpesaMessageId: mpesaMessage.id,
        transactionId: matchedTxnId,
      };
    } catch (error: any) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all suspense (unmatched) M-Pesa messages
   */
  async getSuspenseMessages() {
    return this.prisma.mpesaMessage.findMany({
      where: { status: MpesaMessageStatus.SUSPENSE },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Manually resolve a suspense message by creating a transaction for the specified member
   */
  async resolveSuspenseMessage(mpesaMessageId: string, memberId: string) {
    const mpesaMessage = await this.prisma.mpesaMessage.findUnique({
      where: { id: mpesaMessageId },
    });

    if (!mpesaMessage) {
      throw new Error('M-Pesa message not found');
    }

    if (mpesaMessage.status !== MpesaMessageStatus.SUSPENSE) {
      throw new Error('M-Pesa message is not in suspense status');
    }

    // Verify member exists
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Create transaction
    const transaction = await this.createDepositTransaction(
      memberId,
      mpesaMessage.amount.toNumber(),
      mpesaMessage.mpesaRef,
      undefined,
    );

    // Update M-Pesa message
    await this.prisma.mpesaMessage.update({
      where: { id: mpesaMessageId },
      data: {
        status: MpesaMessageStatus.MATCHED,
        matchedTxnId: transaction.id,
      },
    });

    return transaction;
  }

  /**
   * Validate M-Pesa signature (STUB for now)
   * In production, this should verify the signature from Safaricom
   */
  validateSignature(payload: any, signature?: string): boolean {
    // TODO: Implement actual signature validation
    // For now, always return true (stub)
    this.logger.debug('Signature validation stubbed - accepting all requests');
    return true;
  }

  // ========================
  // PRIVATE HELPER METHODS
  // ========================

  /**
   * Normalize phone number to match stored format
   * Handles: 254712345678, 0712345678, 712345678
   */
  private normalizePhoneNumber(msisdn: string): string {
    // Remove any non-digit characters
    let cleaned = msisdn.replace(/\D/g, '');

    // Remove country code if present
    if (cleaned.startsWith('254')) {
      cleaned = cleaned.substring(3);
    }

    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    return cleaned;
  }

  /**
   * Find members by phone number (checks all phone fields)
   */
  private async findMembersByPhone(phone: string) {
    // Search in phoneLast4, phoneAltLast4 fields
    const last4 = phone.slice(-4);

    return this.prisma.member.findMany({
      where: {
        OR: [
          { phoneLast4: last4 },
          { phoneAltLast4: last4 },
        ],
      },
    });
  }

  /**
   * Create a deposit transaction for M-Pesa payment
   */
  private async createDepositTransaction(
    memberId: string,
    amount: number,
    mpesaRef: string,
    billRef?: string,
  ) {
    const receiptNumber = await this.generateReceiptNumber();

    // Get member's current savings balance
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { savings: true },
    });

    const currentBalance = member?.savings[0]?.balance || new Prisma.Decimal(0);
    const newBalance = currentBalance.add(amount);

    // Create transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        memberId,
        amount: new Prisma.Decimal(amount),
        type: 'SAVINGS_DEPOSIT',
        channel: 'MOBILE_MONEY',
        status: 'POSTED',
        reference: mpesaRef,
        narration: `M-Pesa deposit - ${mpesaRef}${billRef ? ` (${billRef})` : ''}`,
        receiptNumber,
        balanceAfter: newBalance,
        valueDate: new Date(),
      },
    });

    // Update savings balance
    if (member?.savings[0]) {
      await this.prisma.saving.update({
        where: { id: member.savings[0].id },
        data: { balance: newBalance },
      });
    } else {
      // Create savings account if it doesn't exist
      await this.prisma.saving.create({
        data: {
          id: this.generateId(),
          memberId,
          amount: new Prisma.Decimal(amount),
          balance: new Prisma.Decimal(amount),
        },
      });
    }

    return transaction;
  }

  /**
   * Generate receipt number using database sequence
   */
  private async generateReceiptNumber(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<{ receipt_number: string }[]>`
        SELECT generate_receipt_number() as receipt_number
      `;
      return result[0]?.receipt_number || `REC-${Date.now()}`;
    } catch (error) {
      this.logger.warn(`Failed to generate receipt number from DB, using fallback: ${(error as Error).message}`);
      return `REC-${Date.now()}`;
    }
  }

  /**
   * Generate unique ID for entities
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Build narrative from webhook payload
   */
  private buildNarrative(payload: MpesaWebhookDto): string {
    const parts = [
      payload.FirstName,
      payload.MiddleName,
      payload.LastName,
      payload.BillRefNumber,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' ') : 'M-Pesa Payment';
  }
}
