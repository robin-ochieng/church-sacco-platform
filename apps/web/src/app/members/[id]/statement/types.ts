export interface LedgerEntry {
  id: string;
  valueDate?: string;
  date?: string;
  type: string;
  channel: string;
  reference?: string | null;
  narration?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  balance: number;
  receiptNumber?: string | null;
  status?: string;
  createdAt?: string;
}

export interface StatementResponse {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    memberNumber: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  openingBalance: number;
  closingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  transactions: LedgerEntry[];
}

export interface StatementFilters {
  startDate?: string;
  endDate?: string;
  type?: string;
}
