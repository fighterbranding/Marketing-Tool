# Phase 3 Frontend Design — Analytics Dashboard

Date: 2026-07-02

## Overview

A protected analytics dashboard at `/dashboard` showing Meta ad performance data for the logged-in client. Reads from the backend `GET /analytics/insights` endpoint built in Phase 3 backend. Auth via JWT stored in localStorage (existing pattern from Phase 2).

## Decisions

- **Layout:** Clean light top nav, full-width content, date range picker inline in nav bar
- **Color scheme:** Indigo/Purple (`#6366f1` primary, shades for KPI card accents)
- **Default date range:** Last 7 days, stored in URL query params (`?from=&to=`)
- **Data fetching:** React Query (`useInsights` hook), re-fetches when URL params change

---

## Routing Structure

```
frontend/app/
  (auth)/                    ← existing
    login/page.tsx
    register/page.tsx
  (dashboard)/               ← new protected group
    layout.tsx               ← auth guard + NavBar (redirects to /login if no JWT)
    dashboard/
      page.tsx               ← analytics dashboard
  connect-meta/              ← existing
```

The `(dashboard)/layout.tsx` is a client component (`'use client'`) — required because it reads JWT from `localStorage`, which is only available in the browser. On mount it checks for the token and redirects to `/login` if missing using `useRouter`. All future protected pages (campaigns, reports) go inside this group and get auth for free.

---

## Components

| File | Responsibility |
|---|---|
| `app/(dashboard)/layout.tsx` | Auth guard, renders NavBar, wraps page content |
| `app/(dashboard)/dashboard/page.tsx` | Orchestrates state (loading/empty/error/data), passes props to components |
| `components/nav-bar.tsx` | Top bar: logo, nav links, date range picker, client name |
| `components/kpi-card.tsx` | Single metric card: label, value, % change (green/red) |
| `components/trend-chart.tsx` | Recharts LineChart with metric selector (spend/clicks/impressions) |
| `components/dashboard-skeleton.tsx` | Grey placeholder shown during loading |
| `components/empty-state.tsx` | "Data syncing" message shown when no rows exist yet |
| `lib/hooks/use-insights.ts` | React Query hook: fetches /analytics/insights, returns typed data |

---

## Data Flow

```
URL params (?from=2026-06-25&to=2026-07-02)
  └─→ useInsights(from, to)
        └─→ GET /analytics/insights?from=X&to=Z  (JWT in Authorization header via lib/api.ts)
              └─→ { summary: { spend, impressions, clicks, conversions }, daily: [...] }
                    └─→ dashboard/page.tsx
                          ├─→ 4× KpiCard (summary values)
                          └─→ TrendChart (daily array)
```

On first load with no URL params: defaults to last 7 days and writes `?from=&to=` into the URL. Date range changes in NavBar update the URL — React Query re-fetches automatically.

---

## KPI Cards

Four cards in a row: **Spend**, **Impressions**, **Clicks**, **Conversions**.

Each card shows:
- Metric label (small, grey)
- Value (large, bold) — spend formatted as `$X,XXX`, others as plain numbers
- % change vs previous period (green if positive, red if negative)
- Indigo top border accent (different shade per card)

Previous period comparison: `useInsights` makes two parallel API calls — one for the selected range, one for the equal-length window immediately before it. The % change is computed client-side from the two summary totals. No backend changes needed.

---

## Trend Chart

- Recharts `LineChart` inside a `ResponsiveContainer`
- X axis: day labels (e.g. "Jun 25", "Jun 26")
- Y axis: auto-scaled to data
- Metric selector: three buttons (Spend / Clicks / Impressions) — clicking switches the active line
- Single indigo line (`#6366f1`), no dots, smooth curve
- Tooltip on hover showing day + value

---

## Date Range Picker

Simple dropdown in the NavBar with preset options:
- Last 7 days *(default)*
- Last 14 days
- Last 30 days
- Last 90 days

Selecting an option updates `?from=&to=` in the URL. No custom date input for now (YAGNI).

---

## States

| State | Condition | UI |
|---|---|---|
| **Loading** | React Query `isLoading` | `DashboardSkeleton` — grey animated placeholder cards |
| **No data** | Response returns empty `daily: []` | `EmptyState` — "Your data is syncing, check back soon" + refresh button |
| **Error** | React Query `isError` | Error message + retry button |
| **Reconnect needed** | API returns 401 | Banner: "Meta connection expired — reconnect to resume syncing" with link to `/connect-meta` |
| **Data** | `daily.length > 0` | KPI cards + trend chart + "Last synced" note |

---

## Dependencies to Install

- `recharts` — trend chart
- `@types/recharts` is not needed (recharts ships its own types)

---

## Out of Scope

- Campaign performance table (Phase 4 — needs campaign write data)
- PDF/CSV export (Phase 6)
- Custom date range picker (presets cover 95% of use cases)
- Dark mode
