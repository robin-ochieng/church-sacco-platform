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

export async function fetchMpesaSuspenseMessages(): Promise<import('./types').MpesaSuspenseMessage[]> {
  const response = await apiClient.get<import('./types').MpesaSuspenseMessage[]>('/mpesa/suspense');
  return response.data;
}

export async function resolveMpesaSuspenseMessage(messageId: string, memberId: string): Promise<void> {
  await apiClient.patch(`/mpesa/suspense/${messageId}/resolve`, { memberId });
}

