import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Ad, CampaignStatus, CtaType } from '@/lib/types';

async function fetchAds(campaignId: string, adSetId: string): Promise<Ad[]> {
  const { data } = await api.get<Ad[]>(`/campaigns/${campaignId}/ad-sets/${adSetId}/ads`);
  return data;
}

export function useAds(campaignId: string, adSetId: string) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['ads', campaignId, adSetId],
    queryFn: () => fetchAds(campaignId, adSetId),
  });

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      headline: string;
      bodyText: string;
      ctaType: CtaType;
      destinationUrl: string;
      pageId: string;
      image: File;
    }) => {
      const formData = new FormData();
      formData.append('name', input.name);
      formData.append('headline', input.headline);
      formData.append('bodyText', input.bodyText);
      formData.append('ctaType', input.ctaType);
      formData.append('destinationUrl', input.destinationUrl);
      formData.append('pageId', input.pageId);
      formData.append('image', input.image);
      return api.post<Ad>(`/campaigns/${campaignId}/ad-sets/${adSetId}/ads`, formData);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ads', campaignId, adSetId] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) =>
      api.patch<Ad>(`/campaigns/${campaignId}/ad-sets/${adSetId}/ads/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ads', campaignId, adSetId] });
    },
  });

  return { list, create, updateStatus };
}
