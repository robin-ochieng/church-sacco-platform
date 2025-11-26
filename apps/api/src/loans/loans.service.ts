import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, TransactionChannel, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { CreateLoanDto, DisbursementMode } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { UpdateLoanStatusDto } from './dto/update-loan-status.dto';

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService) {}

  async create(createLoanDto: CreateLoanDto) {
    const { memberId, loanAmount, repaymentMonths, disbursementMode } = createLoanDto;

    // 1. Fetch Member and Savings
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { 
        savings: true, 
        loans: true 
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // 2. Validate Eligibility
    // Savings >= 6 months
    // We check the earliest start date of any savings account
    const oldestSaving = member.savings.reduce((oldest, current) => {
      return !oldest || new Date(current.startDate) < new Date(oldest.startDate) ? current : oldest;
    }, null as any);

    if (!oldestSaving) {
      throw new BadRequestException('No savings account found. Member must have savings to qualify for a loan.');
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    if (new Date(oldestSaving.startDate) > sixMonthsAgo) {
      throw new BadRequestException('Savings account must be at least 6 months old to qualify for a loan.');
    }

    // Calculate Total Savings
    const totalSavings = member.savings.reduce((sum, saving) => sum + Number(saving.balance), 0);

    // Check if first loan (no previous loans)
    const previousLoansCount = member.loans.length;
    const multiplier = previousLoansCount === 0 ? 2 : 3;

    const maxLoanAmount = totalSavings * multiplier;

    if (loanAmount > maxLoanAmount) {
      throw new BadRequestException(`Loan amount (${loanAmount}) cannot exceed ${multiplier}x total savings (${maxLoanAmount}).`);
    }

    // 3. Fees
    const processingFee = 300;
    
    // Insurance Fee Calculation (Assuming 1% of loan amount for now as per standard practice, subject to config)
    const insuranceFee = Number(loanAmount) * 0.01; 

    // 4. Create Loan
    // Generate Loan Number (LN-YYYYMMDD-XXXX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const loanNumber = `LN-${dateStr}-${randomSuffix}`;

    return this.prisma.loan.create({
      data: {
        memberId,
        loanNumber,
        amount: loanAmount,
        interestRate: 1.0, // Default interest rate (e.g., 1% per month on reducing balance) - Should be configurable
        durationMonths: repaymentMonths,
        status: LoanStatus.SUBMITTED,
        purpose: createLoanDto.purpose,
        monthlyIncome: createLoanDto.monthlyIncome,
        sourceOfIncome: createLoanDto.sourceIncome,
        processingFee,
        insuranceFee,
        disbursementMode: disbursementMode || DisbursementMode.GROSS,
        balance: 0, // Balance is 0 until disbursement
      },
    });
  }

  async findAll(status?: LoanStatus) {
    return this.prisma.loan.findMany({
      where: status ? { status } : {},
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            memberNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            savings: true,
          },
        },
        repayments: true,
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }

  async updateStatus(id: string, updateLoanStatusDto: UpdateLoanStatusDto) {
    const { status, comment } = updateLoanStatusDto;
    const loan = await this.findOne(id);

    // State transition validation (basic)
    if (loan.status === LoanStatus.DISBURSED && status !== LoanStatus.CLOSED && status !== LoanStatus.DEFAULTED) {
      throw new BadRequestException('Cannot change status of a disbursed loan except to CLOSED or DEFAULTED');
    }

    const updateData: any = { status };

    if (status === LoanStatus.APPROVED) {
      updateData.approvalDate = new Date();
    } else if (status === LoanStatus.DISBURSED) {
      if (loan.status !== LoanStatus.APPROVED) {
        throw new BadRequestException('Loan must be APPROVED before disbursement');
      }
      updateData.disbursementDate = new Date();
      updateData.balance = loan.amount; // Set initial balance

      // Handle Disbursement Transaction
      await this.prisma.$transaction(async (tx) => {
        // 1. Update Loan
        await tx.loan.update({
          where: { id },
          data: updateData,
        });

        // 2. Create Transaction
        let disbursementAmount = Number(loan.amount);
        if (loan.disbursementMode === 'NET') {
          const fees = Number(loan.processingFee || 0) + Number(loan.insuranceFee || 0);
          disbursementAmount -= fees;
        }

        await tx.transaction.create({
          data: {
            memberId: loan.memberId,
            amount: disbursementAmount,
            type: TransactionType.LOAN_DISBURSEMENT,
            channel: TransactionChannel.MOBILE_MONEY, // Default to Mobile Money for now
            status: TransactionStatus.POSTED,
            narration: `Loan Disbursement: ${loan.loanNumber}`,
            reference: loan.loanNumber,
            branchId: loan.branchId,
          },
        });
      });

      return this.findOne(id);
    }

    return this.prisma.loan.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Approve a loan - P2.3 Enhanced
   * Records approver_id (chairman/secretary/treasurer)
   * Validates guarantor approvals are complete
   */
  async approveLoan(id: string, approverId: string, dto: ApproveLoanDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        guarantors: true,
        member: {
          include: {
            savings: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Validate loan is in correct status
    if (loan.status !== LoanStatus.SUBMITTED && loan.status !== LoanStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        `Cannot approve loan with status ${loan.status}. Loan must be SUBMITTED or UNDER_REVIEW.`
      );
    }

    // Validate all guarantors have approved
    const pendingGuarantors = loan.guarantors.filter(g => g.status === 'PENDING');
    if (pendingGuarantors.length > 0) {
      throw new BadRequestException(
        `Cannot approve loan. ${pendingGuarantors.length} guarantor(s) have not yet approved.`
      );
    }

    // Validate at least minimum guarantors (2 by default)
    const approvedGuarantors = loan.guarantors.filter(g => g.status === 'APPROVED');
    if (approvedGuarantors.length < 2) {
      throw new BadRequestException(
        `Cannot approve loan. At least 2 approved guarantors required, found ${approvedGuarantors.length}.`
      );
    }

    // Validate total guaranteed amount covers loan
    const totalGuaranteed = approvedGuarantors.reduce(
      (sum, g) => sum + Number(g.amountGuaranteed),
      0
    );
    if (totalGuaranteed < Number(loan.amount)) {
      throw new BadRequestException(
        `Total guaranteed amount (${totalGuaranteed}) is less than loan amount (${loan.amount}).`
      );
    }

    // Update loan status to APPROVED
    const updatedLoan = await this.prisma.loan.update({
      where: { id },
      data: {
        status: LoanStatus.APPROVED,
        approvalDate: new Date(),
        approvedBy: approverId,
      },
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            memberNumber: true,
          },
        },
        guarantors: {
          include: {
            guarantorMember: {
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

    return updatedLoan;
  }

  /**
   * Disburse a loan - P2.3 Enhanced
   * Computes net disbursed = gross – (processing fee + insurance + arrears + optional deductions)
   * Creates disbursement transaction with receipt number
   */
  async disburseLoan(id: string, disburserId: string, dto: DisburseLoanDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            savings: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Validate loan is approved
    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot disburse loan with status ${loan.status}. Loan must be APPROVED.`
      );
    }

    // Calculate deductions
    const processingFee = Number(loan.processingFee || 300);
    const insuranceFee = Number(loan.insuranceFee || 0);
    const arrearsDeducted = dto.arrearsDeducted || 0;
    const savingsDeducted = dto.savingsDeducted || 0;
    const sharesDeducted = dto.sharesDeducted || 0;

    const grossAmount = Number(loan.amount);
    const totalDeductions = processingFee + insuranceFee + arrearsDeducted + savingsDeducted + sharesDeducted;

    // Calculate net amount based on disbursement mode
    let netDisbursedAmount: number;
    if (loan.disbursementMode === 'NET') {
      netDisbursedAmount = grossAmount - totalDeductions;
    } else {
      // GROSS mode - full amount disbursed, fees collected separately
      netDisbursedAmount = grossAmount;
    }

    if (netDisbursedAmount <= 0) {
      throw new BadRequestException(
        `Net disbursement amount (${netDisbursedAmount}) must be positive.`
      );
    }

    // Generate receipt number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const receiptNumber = `RCP-${dateStr}-${randomSuffix}`;

    // Execute disbursement in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update Loan
      const updatedLoan = await tx.loan.update({
        where: { id },
        data: {
          status: LoanStatus.DISBURSED,
          disbursementDate: new Date(),
          disbursedBy: disburserId,
          disbursementReceiptNo: receiptNumber,
          netDisbursedAmount,
          arrearsDeducted,
          savingsDeducted,
          sharesDeducted,
          balance: grossAmount, // Full loan amount is the balance to be repaid
        },
      });

      // 2. Create Disbursement Transaction
      await tx.transaction.create({
        data: {
          memberId: loan.memberId,
          amount: netDisbursedAmount,
          type: TransactionType.LOAN_DISBURSEMENT,
          channel: TransactionChannel.MOBILE_MONEY,
          status: TransactionStatus.POSTED,
          receiptNumber,
          narration: `Loan Disbursement: ${loan.loanNumber}. Net amount after deductions.`,
          reference: loan.loanNumber,
          branchId: loan.branchId,
          metadata: {
            grossAmount,
            processingFee,
            insuranceFee,
            arrearsDeducted,
            savingsDeducted,
            sharesDeducted,
            totalDeductions,
            disbursementMode: loan.disbursementMode,
          },
        },
      });

      return updatedLoan;
    });

    return {
      ...result,
      disbursementDetails: {
        grossAmount,
        processingFee,
        insuranceFee,
        arrearsDeducted,
        savingsDeducted,
        sharesDeducted,
        totalDeductions,
        netDisbursedAmount,
        receiptNumber,
      },
    };
  }

  /**
   * Get loan with full details including schedule
   */
  async findOneWithSchedule(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            savings: true,
          },
        },
        repayments: true,
        guarantors: {
          include: {
            guarantorMember: {
              select: {
                firstName: true,
                lastName: true,
                memberNumber: true,
              },
            },
          },
        },
        schedules: {
          orderBy: { installmentNo: 'asc' },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }
}
