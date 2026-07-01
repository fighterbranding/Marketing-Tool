# Analytics dashboard

## Overview

The main landing view after login: KPI summary cards, a trend chart, and a campaign performance table. Reads from your backend's `/insights` endpoint (which itself reads from the TimescaleDB analytics store, not live from Meta).

## Layout

- **KPI cards row** — spend, impressions, clicks, conversions, ROAS for the selected date range, each with a small trend indicator vs. the previous period
- **Trend chart** — line/area chart, metric selector (spend, clicks, conversions), date range picker
- **Campaign table** — sortable list of campaigns with their key metrics, links into the campaign manager

## Implementation

### KPI cards

```tsx
function KpiCard({ label, value, change }: { label: string; value: string; change: number }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
      <p className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
      </p>
    </div>
  );
}
```

### Trend chart with recharts

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function TrendChart({ data, metric }: { data: MetricPoint[]; metric: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey={metric} stroke="#378ADD" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Date range picker

Keep this in URL query params (`?from=2026-06-01&to=2026-06-30`) rather than only local state — makes dashboards shareable/bookmarkable and survives page refresh.

### Loading and empty states

Specifically handle: no campaigns yet (client just connected, sync hasn't run), sync in progress (show a "syncing..." indicator rather than an empty chart), and connection needs reconnect (banner prompting them back to the connect flow, not a confusing empty dashboard).

## Estimated time

1 week including responsive layout and the loading/empty state handling.
