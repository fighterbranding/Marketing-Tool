import { Suspense } from 'react';
import { DashboardContent } from './dashboard-content';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
