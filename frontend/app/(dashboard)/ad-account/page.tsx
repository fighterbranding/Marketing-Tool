'use client';
import { useState } from 'react';
import { useAdAccounts, useAdAccountsForBusiness } from '@/lib/hooks/use-ad-accounts';
import { extractErrorMessage } from '@/lib/extract-error-message';
import type { AdAccount, AdAccountStatus } from '@/lib/types';

const STATUS_STYLES: Record<AdAccountStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DISABLED: 'bg-red-100 text-red-700',
  UNSETTLED: 'bg-amber-100 text-amber-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<AdAccountStatus, string> = {
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  UNSETTLED: 'Unsettled billing',
  PENDING_REVIEW: 'Pending review',
  OTHER: 'Unknown status',
};

function AdAccountRow({
  account,
  isSelected,
  onSelect,
  isSelecting,
}: {
  account: AdAccount;
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
}) {
  const canSelect = account.status === 'ACTIVE';

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{account.name}</p>
        <p className="text-xs text-gray-500">
          {account.currency} · {account.timezoneName}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[account.status]}`}
        >
          {STATUS_LABELS[account.status]}
        </span>
        {isSelected ? (
          <span className="text-sm font-medium text-indigo-600">Selected</span>
        ) : (
          <button
            onClick={onSelect}
            disabled={!canSelect || isSelecting}
            title={canSelect ? undefined : 'This ad account is not active'}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSelecting ? 'Selecting…' : 'Select'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdAccountPage() {
  const { current, businesses, select } = useAdAccounts();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const adAccounts = useAdAccountsForBusiness(selectedBusinessId);

  async function handleSelect(businessId: string, adAccountId: string) {
    setError('');
    try {
      await select.mutateAsync({ businessId, adAccountId });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not select this ad account'));
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Ad account</h1>

      {current.data?.adAccountId && (
        <div className="mb-6 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-800">
          Currently selected ad account: <span className="font-mono">{current.data.adAccountId}</span>
        </div>
      )}

      {current.isError && (
        <p className="text-sm text-gray-500 mb-6">
          {extractErrorMessage(current.error, 'Could not load your Meta connection.')}
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Business</label>
        {businesses.isLoading && <p className="text-sm text-gray-500">Loading businesses…</p>}
        {businesses.isError && (
          <p className="text-sm text-red-600">
            {extractErrorMessage(businesses.error, 'Could not load businesses.')}
          </p>
        )}
        {businesses.data && businesses.data.length === 0 && (
          <p className="text-sm text-gray-500">
            No Business Manager accounts found for this connection.
          </p>
        )}
        {businesses.data && businesses.data.length > 0 && (
          <select
            value={selectedBusinessId ?? ''}
            onChange={(e) => setSelectedBusinessId(e.target.value || null)}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Choose a business…</option>
            {businesses.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {selectedBusinessId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {adAccounts.isLoading && (
            <p className="text-sm text-gray-500 p-4">Loading ad accounts…</p>
          )}
          {adAccounts.isError && (
            <p className="text-sm text-red-600 p-4">
              {extractErrorMessage(adAccounts.error, 'Could not load ad accounts.')}
            </p>
          )}
          {adAccounts.data && adAccounts.data.length === 0 && (
            <p className="text-sm text-gray-500 p-4">
              No ad accounts found for this business.
            </p>
          )}
          {adAccounts.data?.map((account) => (
            <AdAccountRow
              key={account.id}
              account={account}
              isSelected={current.data?.adAccountId === account.id}
              isSelecting={select.isPending}
              onSelect={() => handleSelect(selectedBusinessId, account.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
