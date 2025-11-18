process.env.NEXT_PUBLIC_APP_URL = 'https://web.test';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReceiptPreview from '../ReceiptPreview';
import { Transaction, TransactionChannel, TransactionStatus, TransactionType } from '../../types';
import { apiClient } from '@/lib/api-client';
import { saveBlob } from '@/lib/download';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('@/lib/download', () => {
  const actual = jest.requireActual('@/lib/download');
  return {
    ...actual,
    saveBlob: jest.fn(),
  };
});

const showToastMock = jest.fn();

jest.mock('@/hooks/useTransientToast', () => ({
  useTransientToast: () => ({
    toast: null,
    showToast: showToastMock,
    dismissToast: jest.fn(),
  }),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockSaveBlob = saveBlob as jest.MockedFunction<typeof saveBlob>;

const baseTransaction: Transaction = {
  id: 'txn-1',
  member: {
    id: 'mem-1',
    memberNumber: 'MB-001',
    name: 'John Doe',
  },
  amount: 1500,
  type: TransactionType.SAVINGS_DEPOSIT,
  channel: TransactionChannel.CASH,
  status: TransactionStatus.POSTED,
  reference: 'REF-123',
  narration: 'Monthly savings',
  receiptNumber: 'RCP-2024-0001',
  valueDate: new Date().toISOString(),
  balanceAfter: 5000,
  branchId: 'BR-1',
  createdAt: new Date().toISOString(),
};

describe('ReceiptPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    showToastMock.mockClear();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  const renderComponent = (overrides: Partial<Transaction> = {}) =>
    render(<ReceiptPreview transaction={{ ...baseTransaction, ...overrides }} onNewDeposit={jest.fn()} />);

  it('downloads the teller receipt PDF', async () => {
    mockApiClient.get.mockResolvedValueOnce({ data: new Blob(['test'], { type: 'application/pdf' }) } as any);

    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/receipts/transaction/RCP-2024-0001.pdf', expect.objectContaining({
        responseType: 'blob',
      }));
    });
    expect(mockSaveBlob).toHaveBeenCalled();
  });

  it('copies the verification link to clipboard', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /copy verification link/i }));

    await waitFor(() => {
      expect(navigator.clipboard?.writeText).toHaveBeenCalledWith('https://web.test/verify/receipt/RCP-2024-0001');
    });
  });

  it('shows an error toast when the download fails', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('network error'));

    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Unable to download PDF. Please try again.', 'error');
    });
  });
});
