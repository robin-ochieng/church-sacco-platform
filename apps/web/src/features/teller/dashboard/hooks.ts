import { QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMpesaSuspenseMessages, fetchTellerSummary, resolveMpesaSuspenseMessage } from './api';
import { MpesaSuspenseMessage, TellerSummaryResponse } from './types';

const QUERY_KEY = 'teller-summary';
const SUSPENSE_QUERY_KEY = 'mpesa-suspense';

export const tellerSummaryKey = (date: string): QueryKey => [QUERY_KEY, date];
export const mpesaSuspenseKey = (): QueryKey => [SUSPENSE_QUERY_KEY];

export function useTellerSummaryQuery(date: string) {
  return useQuery<TellerSummaryResponse>({
    queryKey: tellerSummaryKey(date),
    queryFn: ({ signal }) => fetchTellerSummary({ date, signal }),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 4500,
    retry: 1,
  });
}

export function useMpesaSuspenseQuery() {
  return useQuery<MpesaSuspenseMessage[]>({
    queryKey: mpesaSuspenseKey(),
    queryFn: fetchMpesaSuspenseMessages,
    refetchInterval: 10000,
  });
}

export function useResolveMpesaSuspenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, memberId }: { messageId: string; memberId: string }) =>
      resolveMpesaSuspenseMessage(messageId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mpesaSuspenseKey() });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }); // Refresh summary too
    },
  });
}
