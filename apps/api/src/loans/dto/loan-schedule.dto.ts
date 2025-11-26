import { ScheduleStatus } from '@prisma/client';

export class LoanScheduleItemDto {
  id: string;
  installmentNo: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  penaltyDue: number;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  totalDue: number;
  totalPaid: number;
  balanceAfter: number;
  status: ScheduleStatus;
  paidAt?: Date;
}

export class LoanScheduleResponseDto {
  loanId: string;
  loanNumber: string;
  loanAmount: number;
  interestRate: number;
  durationMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayable: number;
  disbursementDate?: Date;
  schedule: LoanScheduleItemDto[];
}

export class LoanScheduleSummaryDto {
  totalPrincipalDue: number;
  totalInterestDue: number;
  totalPenaltyDue: number;
  totalPaid: number;
  totalOutstanding: number;
  nextInstallment?: LoanScheduleItemDto;
  overdueInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
}
