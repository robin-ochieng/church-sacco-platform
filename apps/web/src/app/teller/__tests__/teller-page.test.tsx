import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TellerPage from '../page';
import * as api from '../api';
import { TransactionType, TransactionChannel, TransactionStatus } from '../types';

// Mock the API module
jest.mock('../api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock window.print
global.print = jest.fn();

const mockMember = {
  id: 'member-123',
  memberNumber: 'MEM001',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phoneNumber: '+254712345678',
  branchId: 'branch-1',
};

const mockMembers = [
  mockMember,
  {
    id: 'member-456',
    memberNumber: 'MEM002',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phoneNumber: '+254723456789',
    branchId: 'branch-1',
  },
];

const mockTransaction = {
  id: 'txn-123',
  member: {
    id: mockMember.id,
    memberNumber: mockMember.memberNumber,
    name: `${mockMember.firstName} ${mockMember.lastName}`,
    branchId: mockMember.branchId,
  },
  amount: 5000,
  type: TransactionType.SAVINGS_DEPOSIT,
  channel: TransactionChannel.CASH,
  status: TransactionStatus.POSTED,
  receiptNumber: 'RCP-2024-001234',
  valueDate: '2024-01-15',
  balanceAfter: 15000,
  createdAt: '2024-01-15T10:30:00Z',
};

describe('TellerPage - Complete Deposit Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Member Search', () => {
    it('should render search input on page load', () => {
      render(<TellerPage />);
      
      expect(screen.getByText('Manual Deposit - Teller Interface')).toBeInTheDocument();
      expect(screen.getByLabelText(/Search by Name, Phone, or Member Number/i)).toBeInTheDocument();
    });

    it('should search for members when typing', async () => {
      mockApi.searchMembers.mockResolvedValue(mockMembers);
      const user = userEvent.setup();

      render(<TellerPage />);
      
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(mockApi.searchMembers).toHaveBeenCalledWith('John');
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText(/MEM001/)).toBeInTheDocument();
      });
    });

    it('should select member and show deposit form', async () => {
      mockApi.searchMembers.mockResolvedValue(mockMembers);
      const user = userEvent.setup();

      render(<TellerPage />);
      
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByText('John Doe'));

      expect(screen.getByText('Step 2: Record Deposit')).toBeInTheDocument();
      expect(screen.getByText('Selected Member')).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount \(KES\)/i)).toBeInTheDocument();
    });
  });

  describe('Deposit Form Submission', () => {
    beforeEach(async () => {
      mockApi.searchMembers.mockResolvedValue(mockMembers);
      mockApi.createDeposit.mockResolvedValue(mockTransaction);
    });

    it('should submit deposit and show receipt with receipt number', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Search and select member
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('John Doe'));

      // Fill deposit form
      const amountInput = screen.getByLabelText(/Amount \(KES\)/i);
      await user.type(amountInput, '5000');

      // Select transaction type
      const typeSelect = screen.getByLabelText(/Transaction Type/i);
      await user.selectOptions(typeSelect, 'SAVINGS_DEPOSIT');

      // Select channel (Cash should be selected by default)
      const cashButton = screen.getByRole('button', { name: /💵 Cash/i });
      expect(cashButton).toHaveClass('border-blue-500');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Submit Deposit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApi.createDeposit).toHaveBeenCalledWith({
          memberId: mockMember.id,
          amount: 5000,
          transactionType: 'SAVINGS_DEPOSIT',
          channel: 'CASH',
          reference: undefined,
          narration: undefined,
        });
      });

      // Verify receipt is displayed
      await waitFor(() => {
        expect(screen.getByText('Deposit Successful!')).toBeInTheDocument();
        expect(screen.getByText('RCP-2024-001234')).toBeInTheDocument();
        expect(screen.getByText('Receipt Number')).toBeInTheDocument();
      });
    });

    it('should handle mobile money deposit with reference', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Search and select member
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      // Fill form
      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '3000');
      
      // Select Mobile Money channel
      const mobileMoneyButton = screen.getByRole('button', { name: /📱 Mobile Money/i });
      await user.click(mobileMoneyButton);

      // Enter reference
      const referenceInput = screen.getByLabelText(/Reference Number/i);
      await user.type(referenceInput, 'RKJ8X9P2QW');

      // Submit
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      await waitFor(() => {
        expect(mockApi.createDeposit).toHaveBeenCalledWith(
          expect.objectContaining({
            channel: 'MOBILE_MONEY',
            reference: 'RKJ8X9P2QW',
          })
        );
      });
    });

    it('should validate required reference for non-cash channels', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Search and select member
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      // Fill form with mobile money but no reference
      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '2000');
      const mobileMoneyButton = screen.getByRole('button', { name: /📱 Mobile Money/i });
      await user.click(mobileMoneyButton);

      // Try to submit without reference
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      await waitFor(() => {
        expect(screen.getByText(/Reference number is required for Mobile Money/i)).toBeInTheDocument();
      });

      expect(mockApi.createDeposit).not.toHaveBeenCalled();
    });

    it('should validate amount is required', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Search and select member
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      // Try to submit without amount
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      await waitFor(() => {
        expect(screen.getByText('Amount is required')).toBeInTheDocument();
      });

      expect(mockApi.createDeposit).not.toHaveBeenCalled();
    });

    it('should validate amount has at most 2 decimal places', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Search and select member
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      // Try to enter amount with 3 decimal places
      const amountInput = screen.getByLabelText(/Amount \(KES\)/i);
      await user.type(amountInput, '1000.123');

      // Should only allow 2 decimal places
      expect(amountInput).toHaveValue('1000.12');
    });
  });

  describe('Receipt Preview', () => {
    beforeEach(async () => {
      mockApi.searchMembers.mockResolvedValue(mockMembers);
      mockApi.createDeposit.mockResolvedValue(mockTransaction);
    });

    it('should display all transaction details on receipt', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Complete deposit flow
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '5000');
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      // Verify receipt details
      await waitFor(() => {
        expect(screen.getByText('Receipt Number')).toBeInTheDocument();
        expect(screen.getByText('RCP-2024-001234')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('MEM001')).toBeInTheDocument();
        expect(screen.getByText('Savings Deposit')).toBeInTheDocument();
        expect(screen.getByText('Cash')).toBeInTheDocument();
        expect(screen.getByText(/Ksh\s?5,000/)).toBeInTheDocument();
        expect(screen.getByText(/Ksh\s?15,000/)).toBeInTheDocument(); // Balance after
      });
    });

    it('should expose download and copy actions on receipt', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Complete deposit flow
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '5000');
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      const downloadButton = await screen.findByRole('button', { name: /Download PDF/i });
      const copyButton = screen.getByRole('button', { name: /Copy Verification Link/i });

      expect(downloadButton).toBeInTheDocument();
      expect(copyButton).toBeInTheDocument();
    });

    it('should reset to member search when New Deposit clicked', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Complete deposit flow
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '5000');
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      await waitFor(() => screen.getByText('New Deposit'));

      const newDepositButton = screen.getByRole('button', { name: /New Deposit/i });
      await user.click(newDepositButton);

      // Should return to member search
      expect(screen.getByText('Step 1: Find Member')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Start typing to search...')).toBeInTheDocument();
      expect(screen.queryByText('Receipt Number')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when member search fails', async () => {
      mockApi.searchMembers.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      render(<TellerPage />);
      
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('Failed to search members. Please try again.')).toBeInTheDocument();
      });
    });

    it('should display error when deposit submission fails', async () => {
      mockApi.searchMembers.mockResolvedValue(mockMembers);
      mockApi.createDeposit.mockRejectedValue({
        response: {
          data: {
            message: 'Insufficient balance',
          },
        },
      });
      const user = userEvent.setup();

      render(<TellerPage />);
      
      // Complete form
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '5000');
      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      await waitFor(() => {
        expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    beforeEach(async () => {
      mockApi.searchMembers.mockResolvedValue(mockMembers);
    });

    it('should allow changing selected member', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      expect(screen.getByText('Selected Member')).toBeInTheDocument();

      const changeButton = screen.getByRole('button', { name: /Change Member/i });
      await user.click(changeButton);

      expect(screen.queryByText('Step 2: Record Deposit')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Start typing to search...')).toBeInTheDocument();
    });

    it('should allow canceling deposit form', async () => {
      const user = userEvent.setup();

      render(<TellerPage />);
      
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText('Step 2: Record Deposit')).not.toBeInTheDocument();
    });

    it('should support adding narration to deposit', async () => {
      mockApi.createDeposit.mockResolvedValue(mockTransaction);
      const user = userEvent.setup();

      render(<TellerPage />);
      
      const searchInput = screen.getByPlaceholderText('Start typing to search...');
      await user.type(searchInput, 'John');
      await waitFor(() => screen.getByText('John Doe'));
      await user.click(screen.getByText('John Doe'));

      await user.type(screen.getByLabelText(/Amount \(KES\)/i), '5000');
      
      const narrationInput = screen.getByLabelText(/Narration \/ Notes/i);
      await user.type(narrationInput, 'Monthly savings deposit');

      await user.click(screen.getByRole('button', { name: /Submit Deposit/i }));

      await waitFor(() => {
        expect(mockApi.createDeposit).toHaveBeenCalledWith(
          expect.objectContaining({
            narration: 'Monthly savings deposit',
          })
        );
      });
    });
  });
});
