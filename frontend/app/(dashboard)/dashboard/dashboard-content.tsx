'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useInsights } from '@/lib/hooks/use-insights';
import { useCurrentAdAccount } from '@/lib/hooks/use-ad-accounts';
import { KpiCard } from '@/components/kpi-card';
import { TrendChart } from '@/components/trend-chart';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { EmptyState } from '@/components/empty-state';
import type { InsightsSummary } from '@/lib/types';

type Metric = 'spend' | 'clicks' | 'impressions';

function formatSpend(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildKpiConfig(currency: string): {
  key: keyof InsightsSummary;
  label: string;
  accent: string;
  format: (v: number) => string;
}[] {
  return [
    { key: 'spend', label: 'Spend', accent: '#6366f1', format: (v) => formatSpend(v, currency) },
    { key: 'impressions', label: 'Impressions', accent: '#818cf8', format: (v) => v.toLocaleString() },
    { key: 'clicks', label: 'Clicks', accent: '#a5b4fc', format: (v) => v.toLocaleString() },
    { key: 'conversions', label: 'Conversions', accent: '#c4b5fd', format: (v) => v.toLocaleString() },
  ];
}

function getDefaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [metric, setMetric] = useState<Metric>('spend');

  const rawFrom = searchParams.get('from');
  const rawTo = searchParams.get('to');

  useEffect(() => {
    if (!rawFrom || !rawTo) {
      const { from, to } = getDefaultRange();
      router.replace(`/dashboard?from=${from}&to=${to}`);
    }
  }, [rawFrom, rawTo, router]);

  const from = rawFrom ?? getDefaultRange().from;
  const to = rawTo ?? getDefaultRange().to;

  const { isLoading, isError, data, refetch } = useInsights(from, to);
  const { data: adAccount } = useCurrentAdAccount();
  const currency = adAccount?.currency ?? 'USD';

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 mb-4">Something went wrong loading your data.</p>
        <button
          onClick={refetch}
          className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.current.daily.length === 0) {
    return <EmptyState onRefresh={refetch} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {buildKpiConfig(currency).map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.format(data.current.summary[kpi.key])}
            change={pctChange(data.current.summary[kpi.key], data.previous.summary[kpi.key])}
            accentColor={kpi.accent}
          />
        ))}
      </div>
      <TrendChart
        data={data.current.daily}
        metric={metric}
        onMetricChange={setMetric}
        currency={currency}
      />
    </div>
  );
}
