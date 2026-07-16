'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { DailyPoint } from '@/lib/types';

type Metric = 'spend' | 'clicks' | 'impressions';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'spend', label: 'Spend' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'impressions', label: 'Impressions' },
];

interface TrendChartProps {
  data: DailyPoint[];
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
  currency: string;
}

function formatDay(day: string): string {
  const d = new Date(day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatValue(metric: Metric, value: number, currency: string): string {
  if (metric === 'spend') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toLocaleString();
}

export function TrendChart({ data, metric, onMetricChange, currency }: TrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    day: formatDay(d.day),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Trend</h2>
        <div className="flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onMetricChange(m.key)}
              aria-pressed={metric === m.key}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                metric === m.key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280} role="img" aria-label="Ad performance trend chart">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatValue(metric, v, currency)}
          />
          <Tooltip
            formatter={(value) => {
              if (typeof value === 'number') {
                return [formatValue(metric, value, currency), metric];
              }
              return [String(value), metric];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
