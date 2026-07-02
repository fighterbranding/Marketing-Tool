function SkeletonBox({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ''}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonBox className="h-24" />
        <SkeletonBox className="h-24" />
        <SkeletonBox className="h-24" />
        <SkeletonBox className="h-24" />
      </div>
      <SkeletonBox className="h-80" />
    </div>
  );
}
