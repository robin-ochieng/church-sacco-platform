export interface TellerSummaryTotals {
  depositCount: number;
  depositAmount: string;
  uniqueMembers: number;
}

export interface TellerSummaryTopMember {
  memberId: string;
  fullName: string;
  avatarUrl?: string;
  receiptCount: number;
  totalDeposits: string;
  lastReceiptId: string;
  lastReceiptTimestamp: string;
}

export interface TellerSummaryReceipt {
  id: string;
  memberName: string;
  amount: string;
  method: 'CASH' | 'MPESA' | 'EFT' | string;
  tellerName: string;
  status: 'POSTED' | 'PENDING' | 'FAILED';
  timestamp: string;
}

export interface TellerSummaryCloseDayDryRun {
  eligible: boolean;
  projectedNetCash: string;
  warnings: string[];
  lastReceiptTimestamp: string;
}

export interface TellerSummaryResponse {
  date: string;
  meta?: {
    generatedAt: string;
  };
  totals: TellerSummaryTotals;
  topMembers: TellerSummaryTopMember[];
  recentReceipts: TellerSummaryReceipt[];
  closeDayDryRun: TellerSummaryCloseDayDryRun;
}

export interface MpesaSuspenseMessage {
  id: string;
  mpesaRef: string;
  msisdn: string;
  amount: string;
  narrative: string | null;
  status: 'SUSPENSE' | 'MATCHED' | 'DUPLICATE';
  createdAt: string;
}

