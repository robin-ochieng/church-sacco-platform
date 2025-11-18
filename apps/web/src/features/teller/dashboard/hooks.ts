import { QueryKey, useQuery } from '@tanstack/react-query';
import { fetchTellerSummary } from './api';
import { TellerSummaryResponse } from './types';

const QUERY_KEY = 'teller-summary';

export const tellerSummaryKey = (date: string): QueryKey => [QUERY_KEY, date];

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
