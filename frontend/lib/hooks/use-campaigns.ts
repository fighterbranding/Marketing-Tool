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

  return { list, create, updateStatus };
}
