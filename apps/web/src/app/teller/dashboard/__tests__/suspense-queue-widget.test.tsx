import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuspenseQueueWidget } from '../suspense-queue-widget';
import { useMpesaSuspenseQuery, useResolveMpesaSuspenseMutation } from '@/features/teller/dashboard/hooks';

// Mock the hooks
jest.mock('@/features/teller/dashboard/hooks');

describe('SuspenseQueueWidget', () => {
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useResolveMpesaSuspenseMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('should render nothing when there are no messages', () => {
    (useMpesaSuspenseQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });

    const { container } = render(<SuspenseQueueWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render messages when available', () => {
    const mockMessages = [
      {
        id: 'msg-1',
        mpesaRef: 'SAF123',
        msisdn: '254712345678',
        amount: '1000',
        narrative: 'Test Payment',
        status: 'SUSPENSE',
        createdAt: '2025-11-20T10:00:00Z',
      },
    ];

    (useMpesaSuspenseQuery as jest.Mock).mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<SuspenseQueueWidget />);
    expect(screen.getByText('⚠️ Suspense Queue (1)')).toBeInTheDocument();
    expect(screen.getByText('SAF123')).toBeInTheDocument();
    expect(screen.getByText('254712345678')).toBeInTheDocument();
  });

  it('should open modal and submit resolution', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        mpesaRef: 'SAF123',
        msisdn: '254712345678',
        amount: '1000',
        narrative: 'Test Payment',
        status: 'SUSPENSE',
        createdAt: '2025-11-20T10:00:00Z',
      },
    ];

    (useMpesaSuspenseQuery as jest.Mock).mockReturnValue({
      data: mockMessages,
      isLoading: false,
    });

    render(<SuspenseQueueWidget />);

    // 1. Click Resolve button
    const resolveBtn = screen.getByText('Resolve');
    fireEvent.click(resolveBtn);

    // 2. Check modal opens
    expect(screen.getByText('Resolve Suspense Transaction')).toBeInTheDocument();

    // 3. Enter Member ID
    const input = screen.getByPlaceholderText('e.g. clp...');
    fireEvent.change(input, { target: { value: 'mem-123' } });

    // 4. Submit form
    const submitBtn = screen.getByText('Assign & Post');
    fireEvent.click(submitBtn);

    // 5. Verify mutation called
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        messageId: 'msg-1',
        memberId: 'mem-123',
      });
    });
  });
});
