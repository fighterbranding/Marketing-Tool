import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TargetingSuggestion } from '@/lib/types';

async function searchTargeting(query: string): Promise<TargetingSuggestion[]> {
  const { data } = await api.get<TargetingSuggestion[]>('/targeting/search', {
    params: { q: query },
  });
  return data;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useTargetingSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 300);

  return useQuery({
    queryKey: ['targeting-search', debouncedQuery],
    queryFn: () => searchTargeting(debouncedQuery),
    enabled: debouncedQuery.trim().length > 2,
  });
}
