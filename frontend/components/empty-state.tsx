interface EmptyStateProps {
  onRefresh: () => void;
}

export function EmptyState({ onRefresh }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-4xl mb-4">📊</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Your data is syncing</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        We're pulling your Meta ad data in the background. This usually takes a few minutes.
      </p>
      <button
        onClick={onRefresh}
        className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
