import { apiClient } from '@/lib/api-client';
import { TellerSummaryResponse } from './types';

export interface FetchTellerSummaryParams {
  date: string;
  signal?: AbortSignal;
}

export async function fetchTellerSummary({
  date,
  signal,
}: FetchTellerSummaryParams): Promise<TellerSummaryResponse> {
  const response = await apiClient.get<TellerSummaryResponse>('/teller/summary', {
    params: { date },
    signal,
  });

  return response.data;
}
