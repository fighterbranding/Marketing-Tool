import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Page } from '@/lib/types';

async function fetchPages(): Promise<Page[]> {
  const { data } = await api.get<Page[]>('/pages');
  return data;
}

export function usePages() {
  return useQuery({
    queryKey: ['pages'],
    queryFn: fetchPages,
  });
}
