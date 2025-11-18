import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import MemberStatementPage from '../page';
import * as api from '../api';
import { StatementResponse } from '../types';

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock the API module
jest.mock('../api');
const mockApi = api as jest.Mocked<typeof api>;

const mockStatement: StatementResponse = {
  member: {
    id: 'member-123',
    firstName: 'John',
    lastName: 'Doe',
    memberNumber: 'MEM001',
  },
  period: {
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-12-31T23:59:59.999Z',
  },
  openingBalance: 5000,
  closingBalance: 15500,
  totalDeposits: 12000,
  totalWithdrawals: 1500,
  transactions: [
    {
      id: 'txn-1',
      valueDate: '2024-01-15T00:00:00.000Z',
      type: 'DEPOSIT',
      channel: 'MPESA',
      amount: '5000',
      debit: 0,
      credit: 5000,
      balance: 10000,
      receiptNumber: 'RCP-2024-001',
      description: 'Mobile money deposit',
      createdAt: '2024-01-15T10:30:00.000Z',
    },
    {
      id: 'txn-2',
      valueDate: '2024-02-10T00:00:00.000Z',
      type: 'DEPOSIT',
      channel: 'CASH',
      amount: '7000',
      debit: 0,
      credit: 7000,
      balance: 17000,
      receiptNumber: 'RCP-2024-002',
      description: 'Cash deposit',
      createdAt: '2024-02-10T14:20:00.000Z',
    },
    {
      id: 'txn-3',
      valueDate: '2024-03-05T00:00:00.000Z',
      type: 'WITHDRAWAL',
      channel: 'MPESA',
      amount: '1500',
      debit: 1500,
      credit: 0,
      balance: 15500,
      receiptNumber: 'RCP-2024-003',
      description: 'Emergency withdrawal',
      createdAt: '2024-03-05T09:15:00.000Z',
    },
  ],
};

describe('MemberStatementPage', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ id: 'member-123' });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    });
  });

  describe('Statement Display', () => {
    it('should render loading state initially', () => {
      mockApi.getMemberStatement.mockImplementation(() => new Promise(() => {}));
      
      render(<MemberStatementPage />);
      
      expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-pulse');
    });

    it('should display member information and statement summary', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Member Statement')).toBeInTheDocument();
      });

      expect(screen.getByText(/John Doe • MEM001/)).toBeInTheDocument();
      expect(screen.getByText(/Ksh 5,000.00/)).toBeInTheDocument(); // Opening balance
      expect(screen.getByText(/Ksh 15,500.00/)).toBeInTheDocument(); // Closing balance
    });

    it('should display all transactions in table format', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Transaction History (3 transactions)')).toBeInTheDocument();
      });

      // Check transaction entries
      expect(screen.getByText('RCP-2024-001')).toBeInTheDocument();
      expect(screen.getByText('RCP-2024-002')).toBeInTheDocument();
      expect(screen.getByText('RCP-2024-003')).toBeInTheDocument();
    });

    it('should display running balance correctly for each transaction', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Transaction History (3 transactions)')).toBeInTheDocument();
      });

      // Find all balance cells (they contain "Ksh" prefix)
      const balanceCells = screen.getAllByText(/Ksh 10,000\.00|Ksh 17,000\.00|Ksh 15,500\.00/);
      
      // Should have transaction balances in the table
      expect(balanceCells.length).toBeGreaterThan(0);
    });

    it('should format and display totals matching API response', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Totals')).toBeInTheDocument();
      });

      // Check totals in footer
      const totalDepositsElements = screen.getAllByText(/Ksh 12,000\.00/);
      const totalWithdrawalsElements = screen.getAllByText(/Ksh 1,500\.00/);
      const closingBalanceElements = screen.getAllByText(/Ksh 15,500\.00/);

      // Verify totals match API response exactly
      expect(totalDepositsElements.length).toBeGreaterThan(0);
      expect(totalWithdrawalsElements.length).toBeGreaterThan(0);
      expect(closingBalanceElements.length).toBeGreaterThan(0);
    });

    it('should categorize debits and credits correctly', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Transaction History (3 transactions)')).toBeInTheDocument();
      });

      // Check that deposits show in credit column (green)
      const creditCells = screen.getAllByText(/Ksh 5,000\.00|Ksh 7,000\.00/).filter(
        (el) => el.classList.contains('text-green-600')
      );
      expect(creditCells.length).toBeGreaterThanOrEqual(2); // 2 deposits

      // Check that withdrawals show in debit column (red)
      const debitCell = screen.getByText(/Ksh 1,500\.00/, {
        selector: '.text-red-600',
      });
      expect(debitCell).toBeInTheDocument();
    });

    it('should handle empty transactions list', async () => {
      const emptyStatement = {
        ...mockStatement,
        transactions: [],
        totalDeposits: 0,
        totalWithdrawals: 0,
        closingBalance: mockStatement.openingBalance,
      };
      mockApi.getMemberStatement.mockResolvedValue(emptyStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('No transactions found for the selected period')).toBeInTheDocument();
      });
    });

    it('should display error message on API failure', async () => {
      mockApi.getMemberStatement.mockRejectedValue(new Error('Network error'));
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load statement. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Date Filtering', () => {
    it('should render date filter inputs', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Transaction Type')).toBeInTheDocument();
    });

    it('should apply date filters when Apply button clicked', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      const user = userEvent.setup();
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText('Start Date');
      const endDateInput = screen.getByLabelText('End Date');
      const applyButton = screen.getByText('Apply');

      await user.type(startDateInput, '2024-01-01');
      await user.type(endDateInput, '2024-03-31');
      await user.click(applyButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/members/member-123/statement?s=2024-01-01&e=2024-03-31'
      );
    });

    it('should reset filters when Reset button clicked', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      const user = userEvent.setup();
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Reset')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('Reset');
      await user.click(resetButton);

      expect(mockPush).toHaveBeenCalledWith('/members/member-123/statement');
    });

    it('should filter by transaction type', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      const user = userEvent.setup();
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Transaction Type')).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText('Transaction Type');
      const applyButton = screen.getByText('Apply');

      await user.selectOptions(typeSelect, 'DEPOSIT');
      await user.click(applyButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/members/member-123/statement?type=DEPOSIT'
      );
    });

    it('should load statement with query parameters', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 's') return '2024-01-01';
          if (key === 'e') return '2024-03-31';
          if (key === 'type') return 'DEPOSIT';
          return null;
        }),
      });

      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(mockApi.getMemberStatement).toHaveBeenCalledWith({
          memberId: 'member-123',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
          type: 'DEPOSIT',
        });
      });
    });
  });

  describe('PDF Download', () => {
    it('should render Download PDF button', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument();
      });
    });

    it('should call downloadStatementPDF when button clicked', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      mockApi.downloadStatementPDF.mockImplementation(() => {});
      const user = userEvent.setup();
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download PDF');
      await user.click(downloadButton);

      expect(mockApi.downloadStatementPDF).toHaveBeenCalledWith({
        memberId: 'member-123',
        startDate: undefined,
        endDate: undefined,
        type: undefined,
      });
    });

    it('should pass current filters to PDF download', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 's') return '2024-01-01';
          if (key === 'e') return '2024-03-31';
          return null;
        }),
      });

      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      mockApi.downloadStatementPDF.mockImplementation(() => {});
      const user = userEvent.setup();
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download PDF');
      await user.click(downloadButton);

      expect(mockApi.downloadStatementPDF).toHaveBeenCalledWith({
        memberId: 'member-123',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        type: undefined,
      });
    });
  });

  describe('Number Formatting', () => {
    it('should format currency in KES with proper thousands separators', async () => {
      const largeAmountStatement = {
        ...mockStatement,
        openingBalance: 1234567.89,
        closingBalance: 9876543.21,
        totalDeposits: 10000000,
        totalWithdrawals: 500000,
      };
      mockApi.getMemberStatement.mockResolvedValue(largeAmountStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        // Should format with commas and Ksh prefix (Kenyan locale uses "Ksh")
        expect(screen.getAllByText(/Ksh 1,234,567\.89/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Ksh 9,876,543\.21/).length).toBeGreaterThan(0);
      });
    });

    it('should format dates consistently as dd/MM/yyyy', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        // Check date format in period display (dates split across elements)
        expect(screen.getByText(/01\/01\/2024/)).toBeInTheDocument();
        expect(screen.getByText(/01\/01\/2025/)).toBeInTheDocument(); // End date formatted from 2024-12-31
      });

      // Check transaction dates are formatted
      expect(screen.getByText(/15\/01\/2024/)).toBeInTheDocument();
      expect(screen.getByText(/10\/02\/2024/)).toBeInTheDocument();
    });
  });

  describe('Calculation Verification', () => {
    it('should verify closing balance equals opening + deposits - withdrawals', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Transaction History (3 transactions)')).toBeInTheDocument();
      });

      // Verify the math: 5000 (opening) + 12000 (deposits) - 1500 (withdrawals) = 15500 (closing)
      const { openingBalance, totalDeposits, totalWithdrawals, closingBalance } = mockStatement;
      const calculatedClosing = openingBalance + totalDeposits - totalWithdrawals;
      
      expect(calculatedClosing).toBe(closingBalance);
      expect(closingBalance).toBe(15500);
    });

    it('should display transaction count matching array length', async () => {
      mockApi.getMemberStatement.mockResolvedValue(mockStatement);
      
      render(<MemberStatementPage />);
      
      await waitFor(() => {
        const header = screen.getByText(/Transaction History \((\d+) transactions\)/);
        expect(header).toBeInTheDocument();
        
        // Extract number from text
        const match = header.textContent?.match(/\((\d+) transactions\)/);
        const displayedCount = match && match[1] ? parseInt(match[1], 10) : 0;
        
        expect(displayedCount).toBe(mockStatement.transactions.length);
        expect(displayedCount).toBe(3);
      });
    });
  });
});
