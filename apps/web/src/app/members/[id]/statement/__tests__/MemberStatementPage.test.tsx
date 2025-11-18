import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import MemberStatementPage from '../page';
import * as api from '../api';
import { StatementResponse } from '../types';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../api');

const showToastMock = jest.fn();

jest.mock('@/hooks/useTransientToast', () => ({
  useTransientToast: () => ({
    toast: null,
    showToast: showToastMock,
    dismissToast: jest.fn(),
  }),
}));

const mockApi = api as jest.Mocked<typeof api>;
const searchParamValues: Record<string, string | null> = {};
const mockSearchParams = {
  get: jest.fn((key: string) => searchParamValues[key] ?? null),
};

const mockRouter = {
  push: jest.fn(),
};

const mockStatement: StatementResponse = {
  member: {
    id: 'member-123',
    firstName: 'Jane',
    lastName: 'Doe',
    memberNumber: 'MB-001',
  },
  period: {
    startDate: '2024-01-01',
    endDate: '2024-02-01',
  },
  openingBalance: 1000,
  closingBalance: 2500,
  totalDeposits: 2000,
  totalWithdrawals: 500,
  transactions: [
    {
      id: 'txn-1',
      type: 'DEPOSIT',
      channel: 'CASH',
      debit: 0,
      credit: 2000,
      balance: 2500,
      receiptNumber: 'RCP-1',
      valueDate: '2024-01-05',
      createdAt: '2024-01-05T08:00:00Z',
    },
  ],
};

const renderPage = async () => {
  render(<MemberStatementPage />);
  await waitFor(() => expect(mockApi.getMemberStatement).toHaveBeenCalled());
};

beforeEach(() => {
  jest.clearAllMocks();
  showToastMock.mockClear();
  mockApi.getMemberStatement.mockResolvedValue(mockStatement);
  mockRouter.push.mockClear();
  Object.keys(searchParamValues).forEach((key) => delete searchParamValues[key]);
  mockSearchParams.get.mockImplementation((key: string) => searchParamValues[key] ?? null);
  (useParams as jest.Mock).mockReturnValue({ id: 'member-123' });
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
});

describe('MemberStatementPage downloads', () => {
  it('downloads the member statement PDF with active filters', async () => {
    searchParamValues.s = '2024-01-01';
    searchParamValues.e = '2024-02-01';
    searchParamValues.type = 'DEPOSIT';
    mockApi.downloadStatementPDF.mockResolvedValueOnce(undefined);

    await renderPage();
    const downloadButton = await screen.findByRole('button', { name: /^Download PDF$/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockApi.downloadStatementPDF).toHaveBeenCalledWith({
        memberId: 'member-123',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        type: 'DEPOSIT',
      });
    });

    expect(showToastMock).toHaveBeenCalledWith('Statement PDF download started');
  });

  it('surfaces an error toast when the statement download fails', async () => {
    mockApi.downloadStatementPDF.mockRejectedValueOnce(new Error('network error'));

    await renderPage();
    const downloadButton = await screen.findByRole('button', { name: /^Download PDF$/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Unable to download PDF. Please try again.', 'error');
    });
  });

  it('downloads an individual receipt from the table actions', async () => {
    mockApi.downloadReceiptPDF.mockResolvedValueOnce(undefined);

    await renderPage();
    const receiptButton = await screen.findByRole('button', { name: /download receipt pdf/i });
    fireEvent.click(receiptButton);

    await waitFor(() => {
      expect(mockApi.downloadReceiptPDF).toHaveBeenCalledWith({
        memberId: 'member-123',
        receiptNumber: 'RCP-1',
      });
    });

    expect(showToastMock).toHaveBeenCalledWith('Receipt PDF download started');
  });

  it('shows an error toast when the receipt download fails', async () => {
    mockApi.downloadReceiptPDF.mockRejectedValueOnce(new Error('boom'));

    await renderPage();
    const receiptButton = await screen.findByRole('button', { name: /download receipt pdf/i });
    fireEvent.click(receiptButton);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Unable to download receipt. Please try again.', 'error');
    });
  });
});
