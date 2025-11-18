import '@testing-library/jest-dom';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardWidget } from '../dashboard-widget';
import type { TellerSummaryResponse } from '@/features/teller/dashboard/types';
import { useTellerSummaryQuery } from '@/features/teller/dashboard/hooks';

jest.mock('@/features/teller/dashboard/hooks', () => {
  const actual = jest.requireActual('@/features/teller/dashboard/hooks');
  return {
    ...actual,
    useTellerSummaryQuery: jest.fn(),
  };
});

const mockUseTellerSummaryQuery = useTellerSummaryQuery as jest.MockedFunction<typeof useTellerSummaryQuery>;

const baseSummary: TellerSummaryResponse = {
  date: '2024-05-15',
  totals: {
    depositCount: 0,
    depositAmount: '0.00',
    uniqueMembers: 0,
  },
  topMembers: [],
  recentReceipts: [],
  closeDayDryRun: {
    eligible: false,
    projectedNetCash: '0.00',
    warnings: ['Close day unavailable'],
    lastReceiptTimestamp: '',
  },
};

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('DashboardWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty states when no data is returned', () => {
    mockUseTellerSummaryQuery.mockReturnValue({
      data: baseSummary,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
    } as any);

    renderWithClient(<DashboardWidget initialDate={baseSummary.date} />);

    expect(screen.getByText(/No members have deposited yet today/i)).toBeInTheDocument();
    expect(screen.getByText(/No receipts have been posted yet/i)).toBeInTheDocument();
  });

  it('renders KPI totals and top member information', () => {
    const summary: TellerSummaryResponse = {
      ...baseSummary,
      totals: {
        depositCount: 12,
        depositAmount: '125000.00',
        uniqueMembers: 5,
      },
      topMembers: [
        {
          memberId: 'm-1',
          fullName: 'Jane Doe',
          avatarUrl: undefined,
          receiptCount: 3,
          totalDeposits: '60000.00',
          lastReceiptId: 'RCP-1',
          lastReceiptTimestamp: '2024-05-15T08:30:00Z',
        },
      ],
    };

    mockUseTellerSummaryQuery.mockReturnValue({
      data: summary,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
    } as any);

    renderWithClient(<DashboardWidget initialDate={summary.date} />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/Ksh\s?125,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Last #RCP-1/)).toBeInTheDocument();
  });

  it('renders receipt links pointing to details page', () => {
    const summary: TellerSummaryResponse = {
      ...baseSummary,
      recentReceipts: [
        {
          id: 'receipt-1',
          memberName: 'Michael Kim',
          amount: '5000.00',
          method: 'CASH',
          tellerName: 'Lydia',
          status: 'POSTED',
          timestamp: '2024-05-15T09:00:00Z',
        },
      ],
    };

    mockUseTellerSummaryQuery.mockReturnValue({
      data: summary,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
    } as any);

    renderWithClient(<DashboardWidget initialDate={summary.date} />);

    const link = screen.getByRole('link', { name: /View #receipt-1/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/receipts/receipt-1');
  });
});
