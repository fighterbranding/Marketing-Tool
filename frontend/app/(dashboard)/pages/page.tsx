'use client';
import { usePages } from '@/lib/hooks/use-pages';
import { extractErrorMessage } from '@/lib/extract-error-message';
import type { Page } from '@/lib/types';

function PageRow({ page }: { page: Page }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{page.name}</p>
        {page.instagramAccount ? (
          <p className="text-xs text-gray-500">Instagram: @{page.instagramAccount.username}</p>
        ) : (
          <p className="text-xs text-gray-400">No Instagram Business account linked</p>
        )}
      </div>
      {page.instagramAccount?.profilePictureUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Meta-hosted profile image, not a local asset
        <img
          src={page.instagramAccount.profilePictureUrl}
          alt={`@${page.instagramAccount.username}`}
          className="w-8 h-8 rounded-full"
        />
      )}
    </div>
  );
}

export default function PagesPage() {
  const { data, isLoading, isError, error, refetch } = usePages();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pages</h1>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading pages…</p>}

      {isError && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 mb-4">
            {extractErrorMessage(error, 'Something went wrong loading your pages.')}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
          >
            Retry
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Pages found</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            No Facebook Pages are linked to this Meta account yet.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {data.map((page) => (
            <PageRow key={page.id} page={page} />
          ))}
        </div>
      )}
    </div>
  );
}
