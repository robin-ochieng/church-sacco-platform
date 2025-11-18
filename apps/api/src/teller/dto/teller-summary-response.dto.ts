export interface TellerSummaryTotalsDto {
  depositCount: number;
  depositAmount: string;
  uniqueMembers: number;
}

export interface TellerSummaryTopMemberDto {
  memberId: string;
  fullName: string;
  avatarUrl?: string;
  receiptCount: number;
  totalDeposits: string;
  lastReceiptId: string;
  lastReceiptTimestamp: string;
}

export interface TellerSummaryReceiptDto {
  id: string;
  memberName: string;
  amount: string;
  method: string;
  tellerName: string;
  status: string;
  timestamp: string;
}

export interface CloseDayDryRunDto {
  eligible: boolean;
  projectedNetCash: string;
  warnings: string[];
  lastReceiptTimestamp: string;
}

export interface TellerSummaryResponseDto {
  date: string;
  meta: {
    generatedAt: string;
  };
  totals: TellerSummaryTotalsDto;
  topMembers: TellerSummaryTopMemberDto[];
  recentReceipts: TellerSummaryReceiptDto[];
  closeDayDryRun: CloseDayDryRunDto;
}
