import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdSet, CampaignStatus, OptimizationGoal, TargetingSpec } from '@/lib/types';

async function fetchAdSets(campaignId: string): Promise<AdSet[]> {
  const { data } = await api.get<AdSet[]>(`/campaigns/${campaignId}/ad-sets`);
  return data;
}

export function useAdSets(campaignId: string) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['ad-sets', campaignId],
    queryFn: () => fetchAdSets(campaignId),
  });

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      dailyBudgetCents: number;
      optimizationGoal: OptimizationGoal;
      targeting: TargetingSpec;
    }) => api.post<AdSet>(`/campaigns/${campaignId}/ad-sets`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ad-sets', campaignId] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) =>
      api.patch<AdSet>(`/campaigns/${campaignId}/ad-sets/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ad-sets', campaignId] });
    },
  });

  return { list, create, updateStatus };
}
