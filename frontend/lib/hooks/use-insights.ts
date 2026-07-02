import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InsightsResponse, InsightsData } from '@/lib/types';

async function fetchInsights(from: string, to: string): Promise<InsightsResponse> {
  const { data } = await api.get<InsightsResponse>('/analytics/insights', {
    params: { from, to },
  });
  return data;
}

function getPreviousWindow(from: string, to: string): { prevFrom: string; prevTo: string } {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const duration = toMs - fromMs;
  const prevToMs = fromMs - 1;
  const prevFromMs = prevToMs - duration;
  return {
    prevFrom: new Date(prevFromMs).toISOString().split('T')[0],
    prevTo: new Date(prevToMs).toISOString().split('T')[0],
  };
}

export function useInsights(from: string, to: string) {
  const enabled = !!from && !!to;
  const { prevFrom, prevTo } = getPreviousWindow(from, to);

  const current = useQuery({
    queryKey: ['insights', from, to],
    queryFn: () => fetchInsights(from, to),
    enabled,
  });

  const previous = useQuery({
    queryKey: ['insights', prevFrom, prevTo],
    queryFn: () => fetchInsights(prevFrom, prevTo),
    enabled,
  });

  const data: InsightsData | undefined =
    current.data && previous.data
      ? { current: current.data, previous: previous.data }
      : undefined;

  return {
    isLoading: current.isLoading || previous.isLoading,
    isError: current.isError || previous.isError,
    data,
    refetch: () => {
      void current.refetch();
      void previous.refetch();
    },
  };
}
