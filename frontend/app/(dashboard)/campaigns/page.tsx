'use client';
import { useState } from 'react';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
import { extractErrorMessage } from '@/lib/extract-error-message';
import { StatusBadge } from '@/components/status-badge';
import { AdSetsPanel } from '@/components/ad-sets-panel';
import type { Campaign, CampaignObjective } from '@/lib/types';

const OBJECTIVES: { value: CampaignObjective; label: string }[] = [
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
];

function objectiveLabel(objective: CampaignObjective): string {
  return OBJECTIVES.find((o) => o.value === objective)?.label ?? objective;
}

function CreateCampaignForm({ onDone }: { onDone: () => void }) {
  const { create } = useCampaigns();
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<CampaignObjective>('OUTCOME_TRAFFIC');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await create.mutateAsync({ name, objective });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create campaign'));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 mb-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Campaign name</label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Objective</label>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value as CampaignObjective)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        New campaigns are always created paused. You launch them explicitly once ready.
      </p>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create campaign'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CampaignRow({
  campaign,
  isExpanded,
  onToggleExpand,
}: {
  campaign: Campaign;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { updateStatus, update, remove } = useCampaigns();
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(campaign.name);
  const nextStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

  async function handleToggle() {
    setError('');
    try {
      await updateStatus.mutateAsync({ id: campaign.id, status: nextStatus });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not update status'));
    }
  }

  async function handleSaveName() {
    setError('');
    try {
      await update.mutateAsync({ id: campaign.id, name: nameDraft });
      setIsEditingName(false);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not rename campaign'));
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${campaign.name}"? This can't be undone.`)) return;
    setError('');
    try {
      await remove.mutateAsync(campaign.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not delete campaign'));
    }
  }

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0">
        <td className="py-3 px-4 text-sm text-gray-900">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={100}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSaveName}
                disabled={update.isPending}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setNameDraft(campaign.name);
                  setIsEditingName(false);
                }}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-2 hover:text-indigo-600"
            >
              <span
                className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              >
                ▸
              </span>
              {campaign.name}
            </button>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-gray-600">{objectiveLabel(campaign.objective)}</td>
        <td className="py-3 px-4">
          <StatusBadge status={campaign.status} />
        </td>
        <td className="py-3 px-4 text-right space-x-3">
          <button
            onClick={handleToggle}
            disabled={updateStatus.isPending}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {campaign.status === 'ACTIVE' ? 'Pause' : 'Resume'}
          </button>
          {!isEditingName && (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={remove.isPending}
            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Delete
          </button>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-gray-100 last:border-0 bg-gray-50/50">
          <td colSpan={4} className="p-4">
            <AdSetsPanel campaignId={campaign.id} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function CampaignsPage() {
  const { list } = useCampaigns();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Campaigns</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            New campaign
          </button>
        )}
      </div>

      {showForm && <CreateCampaignForm onDone={() => setShowForm(false)} />}

      {list.isLoading && <p className="text-sm text-gray-500">Loading campaigns…</p>}

      {list.isError && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 mb-4">Something went wrong loading your campaigns.</p>
          <button
            onClick={() => list.refetch()}
            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
          >
            Retry
          </button>
        </div>
      )}

      {list.data && list.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">📢</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No campaigns yet</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            Create your first campaign to get started. It will be saved as paused until you
            launch it.
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">
                  Objective
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">
                  Status
                </th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  isExpanded={expandedId === campaign.id}
                  onToggleExpand={() =>
                    setExpandedId((current) => (current === campaign.id ? null : campaign.id))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
