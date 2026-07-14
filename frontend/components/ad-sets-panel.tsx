'use client';
import { useState } from 'react';
import { useAdSets } from '@/lib/hooks/use-ad-sets';
import { extractErrorMessage } from '@/lib/extract-error-message';
import { StatusBadge } from '@/components/status-badge';
import { InterestPicker } from '@/components/interest-picker';
import type { AdSet, OptimizationGoal, TargetingInterest } from '@/lib/types';

const OPTIMIZATION_GOALS: { value: OptimizationGoal; label: string }[] = [
  { value: 'LINK_CLICKS', label: 'Link clicks' },
  { value: 'REACH', label: 'Reach' },
  { value: 'IMPRESSIONS', label: 'Impressions' },
  { value: 'OFFSITE_CONVERSIONS', label: 'Conversions' },
];

const PLATFORMS: { value: string; label: string }[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
];

function CreateAdSetForm({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const { create } = useAdSets(campaignId);
  const [name, setName] = useState('');
  const [dailyBudgetDollars, setDailyBudgetDollars] = useState('10');
  const [optimizationGoal, setOptimizationGoal] = useState<OptimizationGoal>('LINK_CLICKS');
  const [country, setCountry] = useState('US');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram']);
  const [interests, setInterests] = useState<TargetingInterest[]>([]);
  const [error, setError] = useState('');

  function togglePlatform(value: string) {
    setPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const dailyBudgetCents = Math.round(Number(dailyBudgetDollars) * 100);
    if (!Number.isFinite(dailyBudgetCents) || dailyBudgetCents < 100) {
      setError('Daily budget must be at least $1.00');
      return;
    }
    if (platforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    try {
      await create.mutateAsync({
        name,
        dailyBudgetCents,
        optimizationGoal,
        targeting: { countries: [country], ageMin, ageMax, platforms, interests },
      });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create ad set'));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Ad set name</label>
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
          <label className="block text-sm font-medium text-gray-700">Daily budget ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={dailyBudgetDollars}
            onChange={(e) => setDailyBudgetDollars(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Optimization goal</label>
          <select
            value={optimizationGoal}
            onChange={(e) => setOptimizationGoal(e.target.value as OptimizationGoal)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {OPTIMIZATION_GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Country</label>
          <input
            type="text"
            required
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="US"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Age range</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={13}
              max={65}
              value={ageMin}
              onChange={(e) => setAgeMin(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              min={13}
              max={65}
              value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Platforms</label>
          <div className="mt-2 flex gap-4">
            {PLATFORMS.map((p) => (
              <label key={p.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={platforms.includes(p.value)}
                  onChange={() => togglePlatform(p.value)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <InterestPicker value={interests} onChange={setInterests} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        New ad sets are always created paused. You launch them explicitly once ready.
      </p>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create ad set'}
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

function AdSetRow({ campaignId, adSet }: { campaignId: string; adSet: AdSet }) {
  const { updateStatus } = useAdSets(campaignId);
  const [error, setError] = useState('');
  const nextStatus = adSet.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

  async function handleToggle() {
    setError('');
    try {
      await updateStatus.mutateAsync({ id: adSet.id, status: nextStatus });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not update status'));
    }
  }

  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{adSet.name}</p>
          <p className="text-xs text-gray-500">
            ${(adSet.dailyBudgetCents / 100).toFixed(2)}/day · {adSet.targeting.countries.join(', ')}{' '}
            · ages {adSet.targeting.ageMin}-{adSet.targeting.ageMax}
            {adSet.targeting.interests.length > 0 &&
              ` · ${adSet.targeting.interests.map((i) => i.name).join(', ')}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={adSet.status} />
          <button
            onClick={handleToggle}
            disabled={updateStatus.isPending}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {adSet.status === 'ACTIVE' ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function AdSetsPanel({ campaignId }: { campaignId: string }) {
  const { list } = useAdSets(campaignId);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Ad sets</h4>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            + New ad set
          </button>
        )}
      </div>

      {showForm && <CreateAdSetForm campaignId={campaignId} onDone={() => setShowForm(false)} />}

      {list.isLoading && <p className="text-sm text-gray-500">Loading ad sets…</p>}
      {list.isError && <p className="text-sm text-red-600">Could not load ad sets.</p>}
      {list.data && list.data.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">No ad sets yet for this campaign.</p>
      )}
      {list.data?.map((adSet) => (
        <AdSetRow key={adSet.id} campaignId={campaignId} adSet={adSet} />
      ))}
    </div>
  );
}
