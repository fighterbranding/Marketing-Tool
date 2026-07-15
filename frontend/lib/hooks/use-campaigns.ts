import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Campaign, CampaignObjective, CampaignStatus } from '@/lib/types';

async function fetchCampaigns(): Promise<Campaign[]> {
  const { data } = await api.get<Campaign[]>('/campaigns');
  return data;
}

export function useCampaigns() {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  const create = useMutation({
    mutationFn: (input: { name: string; objective: CampaignObjective }) =>
      api.post<Campaign>('/campaigns', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) =>
      api.patch<Campaign>(`/campaigns/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<Campaign>(`/campaigns/${id}`, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  return { list, create, updateStatus, update, remove };
}
