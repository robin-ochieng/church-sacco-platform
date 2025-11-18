import '@testing-library/jest-dom';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTellerSummaryQuery } from '../hooks';
import { fetchTellerSummary } from '../api';
import type { TellerSummaryResponse } from '../types';

jest.mock('../api', () => ({
  fetchTellerSummary: jest.fn(),
}));

const mockFetch = fetchTellerSummary as jest.MockedFunction<typeof fetchTellerSummary>;

const mockResponse: TellerSummaryResponse = {
  date: '2024-05-15',
  totals: {
    depositCount: 1,
    depositAmount: '1000.00',
    uniqueMembers: 1,
  },
  topMembers: [],
  recentReceipts: [],
  closeDayDryRun: {
    eligible: false,
    projectedNetCash: '0.00',
    warnings: [],
    lastReceiptTimestamp: '',
  },
};

function TestComponent({ date }: { date: string }) {
  useTellerSummaryQuery(date);
  return null;
}

describe('useTellerSummaryQuery', () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue(mockResponse);
    client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    client.clear();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('polls the endpoint every 5 seconds', async () => {
    render(
      <QueryClientProvider client={client}>
        <TestComponent date="2024-05-15" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
