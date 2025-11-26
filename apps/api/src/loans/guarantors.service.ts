import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { GuarantorStatus, LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddGuarantorDto } from './dto/add-guarantor.dto';
import { ApproveGuarantorDto, GuarantorApprovalAction } from './dto/approve-guarantor.dto';

@Injectable()
export class GuarantorsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add a guarantor to a loan
   * Business Rules:
   * - Guarantor must be a member for at least 12 months
   * - Guarantor's total shares must be >= amount guaranteed
   * - Guarantor cannot guarantee their own loan
   * - Total guaranteed amount cannot exceed loan amount
   * - Member cannot guarantee the same loan twice
   */
  async addGuarantor(loanId: string, dto: AddGuarantorDto) {
    const { guarantorMemberId, amountGuaranteed } = dto;

    // 1. Get the loan
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        guarantors: true,
        member: true,
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // 2. Check loan status - can only add guarantors before disbursement
    const allowedStatuses: LoanStatus[] = [LoanStatus.DRAFT, LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED];
    if (!allowedStatuses.includes(loan.status)) {
      throw new BadRequestException('Cannot add guarantors to a loan that has already been disbursed or closed');
    }

    // 3. Guarantor cannot guarantee their own loan
    if (loan.memberId === guarantorMemberId) {
      throw new BadRequestException('Member cannot guarantee their own loan');
    }

    // 4. Check if already a guarantor for this loan
    const existingGuarantor = loan.guarantors.find(g => g.guarantorMemberId === guarantorMemberId);
    if (existingGuarantor) {
      throw new BadRequestException('This member is already a guarantor for this loan');
    }

    // 5. Get the guarantor member
    const guarantorMember = await this.prisma.member.findUnique({
      where: { id: guarantorMemberId },
      include: {
        shares: true,
        guaranteesGiven: {
          where: {
            status: { in: [GuarantorStatus.PENDING, GuarantorStatus.APPROVED] },
            loan: {
              status: { notIn: [LoanStatus.CLOSED, LoanStatus.REJECTED] },
            },
          },
        },
      },
    });

    if (!guarantorMember) {
      throw new NotFoundException('Guarantor member not found');
    }

    // 6. Check membership duration (≥ 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    if (new Date(guarantorMember.joiningDate) > twelveMonthsAgo) {
      throw new BadRequestException('Guarantor must be a member for at least 12 months');
    }

    // 7. Calculate total shares value
    const totalSharesValue = guarantorMember.shares.reduce(
      (sum, share) => sum + Number(share.totalValue),
      0
    );

    // 8. Calculate existing exposure (amount already guaranteed for other loans)
    const existingExposure = guarantorMember.guaranteesGiven.reduce(
      (sum, g) => sum + Number(g.amountGuaranteed),
      0
    );

    // 9. Available guarantee capacity = Total Shares - Existing Exposure
    const availableCapacity = totalSharesValue - existingExposure;

    if (amountGuaranteed > availableCapacity) {
      throw new BadRequestException(
        `Guarantor does not have sufficient share balance. ` +
        `Total shares: ${totalSharesValue}, Existing exposure: ${existingExposure}, ` +
        `Available: ${availableCapacity}, Requested: ${amountGuaranteed}`
      );
    }

    // 10. Check total guaranteed doesn't exceed loan amount
    const currentTotalGuaranteed = loan.guarantors
      .filter(g => g.status !== GuarantorStatus.DECLINED)
      .reduce((sum, g) => sum + Number(g.amountGuaranteed), 0);

    if (currentTotalGuaranteed + amountGuaranteed > Number(loan.amount)) {
      throw new BadRequestException(
        `Total guaranteed amount (${currentTotalGuaranteed + amountGuaranteed}) ` +
        `cannot exceed loan amount (${loan.amount})`
      );
    }

    // 11. Create the guarantor record
    return this.prisma.guarantor.create({
      data: {
        loanId,
        guarantorMemberId,
        amountGuaranteed,
        status: GuarantorStatus.PENDING,
      },
      include: {
        guarantorMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberNumber: true,
          },
        },
      },
    });
  }

  /**
   * Approve or decline a guarantee request
   * Only the guarantor themselves can approve/decline
   */
  async approveGuarantor(
    loanId: string,
    guarantorId: string,
    dto: ApproveGuarantorDto,
    actingMemberId?: string
  ) {
    const { action, signatureKey, declineReason } = dto;

    // 1. Get the guarantor record
    const guarantor = await this.prisma.guarantor.findUnique({
      where: { id: guarantorId },
      include: {
        loan: true,
        guarantorMember: true,
      },
    });

    if (!guarantor) {
      throw new NotFoundException('Guarantor record not found');
    }

    if (guarantor.loanId !== loanId) {
      throw new BadRequestException('Guarantor does not belong to this loan');
    }

    // 2. Check if already processed
    if (guarantor.status !== GuarantorStatus.PENDING) {
      throw new BadRequestException(`Guarantee request has already been ${guarantor.status.toLowerCase()}`);
    }

    // 3. Verify the acting member is the guarantor (if actingMemberId provided)
    if (actingMemberId && guarantor.guarantorMemberId !== actingMemberId) {
      throw new ForbiddenException('Only the guarantor can approve or decline their own guarantee');
    }

    // 4. Process approval or decline
    if (action === GuarantorApprovalAction.APPROVE) {
      if (!signatureKey) {
        throw new BadRequestException('Signature is required for approval');
      }

      return this.prisma.guarantor.update({
        where: { id: guarantorId },
        data: {
          status: GuarantorStatus.APPROVED,
          signatureKey,
          approvedAt: new Date(),
        },
        include: {
          guarantorMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberNumber: true,
            },
          },
        },
      });
    } else {
      // DECLINE
      return this.prisma.guarantor.update({
        where: { id: guarantorId },
        data: {
          status: GuarantorStatus.DECLINED,
          declineReason: declineReason || 'No reason provided',
          declinedAt: new Date(),
        },
        include: {
          guarantorMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberNumber: true,
            },
          },
        },
      });
    }
  }

  /**
   * Get all guarantors for a loan
   */
  async getGuarantorsForLoan(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return this.prisma.guarantor.findMany({
      where: { loanId },
      include: {
        guarantorMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberNumber: true,
            telephone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get eligible guarantors for a loan
   * Returns members who:
   * - Are not the loan applicant
   * - Have been members for ≥ 12 months
   * - Have shares with available capacity
   */
  async getEligibleGuarantors(loanId: string, searchQuery?: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Get all eligible members
    const members = await this.prisma.member.findMany({
      where: {
        id: { not: loan.memberId }, // Not the loan applicant
        joiningDate: { lte: twelveMonthsAgo }, // Member for ≥ 12 months
        membershipStatus: 'ACTIVE',
        ...(searchQuery && {
          OR: [
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } },
            { memberNumber: { contains: searchQuery, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        shares: true,
        guaranteesGiven: {
          where: {
            status: { in: [GuarantorStatus.PENDING, GuarantorStatus.APPROVED] },
            loan: {
              status: { notIn: [LoanStatus.CLOSED, LoanStatus.REJECTED] },
            },
          },
        },
      },
      take: 50, // Limit results
    });

    // Calculate available capacity for each member
    return members.map(member => {
      const totalSharesValue = member.shares.reduce(
        (sum, share) => sum + Number(share.totalValue),
        0
      );
      const existingExposure = member.guaranteesGiven.reduce(
        (sum, g) => sum + Number(g.amountGuaranteed),
        0
      );
      const availableCapacity = totalSharesValue - existingExposure;

      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        memberNumber: member.memberNumber,
        totalSharesValue,
        existingExposure,
        availableCapacity,
        isEligible: availableCapacity > 0,
      };
    }).filter(m => m.availableCapacity > 0); // Only return members with available capacity
  }

  /**
   * Remove a guarantor (only if pending)
   */
  async removeGuarantor(loanId: string, guarantorId: string) {
    const guarantor = await this.prisma.guarantor.findUnique({
      where: { id: guarantorId },
    });

    if (!guarantor) {
      throw new NotFoundException('Guarantor not found');
    }

    if (guarantor.loanId !== loanId) {
      throw new BadRequestException('Guarantor does not belong to this loan');
    }

    if (guarantor.status !== GuarantorStatus.PENDING) {
      throw new BadRequestException('Can only remove pending guarantors');
    }

    return this.prisma.guarantor.delete({
      where: { id: guarantorId },
    });
  }

  /**
   * Get guarantor exposure summary for a member
   */
  async getGuarantorExposure(memberId: string) {
    const guarantees = await this.prisma.guarantor.findMany({
      where: {
        guarantorMemberId: memberId,
        status: { in: [GuarantorStatus.PENDING, GuarantorStatus.APPROVED] },
        loan: {
          status: { notIn: [LoanStatus.CLOSED, LoanStatus.REJECTED] },
        },
      },
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            amount: true,
            status: true,
            member: {
              select: {
                firstName: true,
                lastName: true,
                memberNumber: true,
              },
            },
          },
        },
      },
    });

    const totalExposure = guarantees.reduce(
      (sum, g) => sum + Number(g.amountGuaranteed),
      0
    );

    return {
      totalExposure,
      activeGuarantees: guarantees.length,
      guarantees: guarantees.map(g => ({
        id: g.id,
        loanNumber: g.loan.loanNumber,
        borrowerName: `${g.loan.member.firstName} ${g.loan.member.lastName}`,
        borrowerMemberNumber: g.loan.member.memberNumber,
        loanAmount: g.loan.amount,
        amountGuaranteed: g.amountGuaranteed,
        status: g.status,
        loanStatus: g.loan.status,
      })),
    };
  }
}
