import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdAccount, Business, CurrentAdAccountSelection } from '@/lib/types';

async function fetchCurrentSelection(): Promise<CurrentAdAccountSelection> {
  const { data } = await api.get<CurrentAdAccountSelection>('/ad-accounts/current');
  return data;
}

async function fetchBusinesses(): Promise<Business[]> {
  const { data } = await api.get<Business[]>('/ad-accounts/businesses');
  return data;
}

async function fetchAdAccounts(businessId: string): Promise<AdAccount[]> {
  const { data } = await api.get<AdAccount[]>('/ad-accounts', { params: { businessId } });
  return data;
}

export function useAdAccounts() {
  const queryClient = useQueryClient();

  const current = useQuery({
    queryKey: ['ad-accounts', 'current'],
    queryFn: fetchCurrentSelection,
  });

  const businesses = useQuery({
    queryKey: ['ad-accounts', 'businesses'],
    queryFn: fetchBusinesses,
  });

  const select = useMutation({
    mutationFn: (input: { businessId: string; adAccountId: string }) =>
      api.post('/ad-accounts/select', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ad-accounts', 'current'] });
    },
  });

  return { current, businesses, select };
}

export function useAdAccountsForBusiness(businessId: string | null) {
  return useQuery({
    queryKey: ['ad-accounts', 'list', businessId],
    queryFn: () => fetchAdAccounts(businessId ?? ''),
    enabled: businessId !== null,
  });
}
