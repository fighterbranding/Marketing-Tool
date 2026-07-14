import type { CampaignStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {isActive ? 'Active' : 'Paused'}
    </span>
  );
}
