'use client';
import { useState } from 'react';
import { useAds } from '@/lib/hooks/use-ads';
import { extractErrorMessage } from '@/lib/extract-error-message';
import { StatusBadge } from '@/components/status-badge';
import type { Ad, CtaType } from '@/lib/types';

const CTA_TYPES: { value: CtaType; label: string }[] = [
  { value: 'LEARN_MORE', label: 'Learn more' },
  { value: 'SHOP_NOW', label: 'Shop now' },
  { value: 'SIGN_UP', label: 'Sign up' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'CONTACT_US', label: 'Contact us' },
];

function CreateAdForm({
  campaignId,
  adSetId,
  onDone,
}: {
  campaignId: string;
  adSetId: string;
  onDone: () => void;
}) {
  const { create } = useAds(campaignId, adSetId);
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [ctaType, setCtaType] = useState<CtaType>('LEARN_MORE');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [pageId, setPageId] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!image) {
      setError('Choose an image for the ad');
      return;
    }

    try {
      await create.mutateAsync({
        name,
        headline,
        bodyText,
        ctaType,
        destinationUrl,
        pageId,
        image,
      });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create ad'));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-4 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Ad name</label>
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
          <label className="block text-sm font-medium text-gray-700">Headline</label>
          <input
            type="text"
            required
            maxLength={255}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Body text</label>
          <textarea
            required
            maxLength={500}
            rows={2}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Call to action</label>
          <select
            value={ctaType}
            onChange={(e) => setCtaType(e.target.value as CtaType)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CTA_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Destination URL</label>
          <input
            type="url"
            required
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Facebook Page ID</label>
          <input
            type="text"
            required
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Image</label>
          <input
            type="file"
            required
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        New ads are always created paused. You launch them explicitly once ready.
      </p>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create ad'}
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

function AdRow({
  campaignId,
  adSetId,
  ad,
}: {
  campaignId: string;
  adSetId: string;
  ad: Ad;
}) {
  const { updateStatus } = useAds(campaignId, adSetId);
  const [error, setError] = useState('');
  const nextStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

  async function handleToggle() {
    setError('');
    try {
      await updateStatus.mutateAsync({ id: ad.id, status: nextStatus });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not update status'));
    }
  }

  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{ad.name}</p>
          <p className="text-xs text-gray-500">
            {ad.headline} · {ad.destinationUrl}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={ad.status} />
          <button
            onClick={handleToggle}
            disabled={updateStatus.isPending}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {ad.status === 'ACTIVE' ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function AdsPanel({ campaignId, adSetId }: { campaignId: string; adSetId: string }) {
  const { list } = useAds(campaignId, adSetId);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ads</h5>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            + New ad
          </button>
        )}
      </div>

      {showForm && (
        <CreateAdForm
          campaignId={campaignId}
          adSetId={adSetId}
          onDone={() => setShowForm(false)}
        />
      )}

      {list.isLoading && <p className="text-sm text-gray-500">Loading ads…</p>}
      {list.isError && <p className="text-sm text-red-600">Could not load ads.</p>}
      {list.data && list.data.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">No ads yet for this ad set.</p>
      )}
      {list.data?.map((ad) => (
        <AdRow key={ad.id} campaignId={campaignId} adSetId={adSetId} ad={ad} />
      ))}
    </div>
  );
}
