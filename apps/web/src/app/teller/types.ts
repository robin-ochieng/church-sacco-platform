export interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  branchId?: string;
}

export enum TransactionType {
  SAVINGS_DEPOSIT = 'SAVINGS_DEPOSIT',
  SHARES_DEPOSIT = 'SHARES_DEPOSIT',
  SPECIAL_CONTRIBUTION = 'SPECIAL_CONTRIBUTION',
  MAINTENANCE_FEE = 'MAINTENANCE_FEE',
  WITHDRAWAL = 'WITHDRAWAL',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum TransactionChannel {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CHEQUE = 'CHEQUE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

export interface Transaction {
  id: string;
  member: {
    id: string;
    memberNumber: string;
    name: string;
    branchId?: string;
  };
  amount: number;
  type: TransactionType;
  channel: TransactionChannel;
  status: TransactionStatus;
  reference?: string;
  narration?: string;
  receiptNumber: string;
  valueDate: string;
  balanceAfter: number;
  branchId?: string;
  createdAt: string;
  cashierId?: string;
}

export interface CreateDepositRequest {
  memberId?: string;
  memberNumber?: string;
  amount: number;
  transactionType: TransactionType;
  channel: TransactionChannel;
  reference?: string;
  narration?: string;
  valueDate?: string;
  branchId?: string;
  metadata?: Record<string, any>;
}

export interface DepositFormData {
  amount: string;
  transactionType: TransactionType;
  channel: TransactionChannel;
  reference: string;
  narration: string;
}
