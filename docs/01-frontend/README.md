# Frontend layer overview

Next.js + TypeScript + Tailwind app. Four main views map directly to the architecture squares.

| View | File | Purpose |
|---|---|---|
| Analytics dashboard | [analytics-dashboard.md](analytics-dashboard.md) | Charts, KPI cards |
| Campaign manager | [campaign-manager.md](campaign-manager.md) | Create/edit/pause campaigns |
| Client accounts | [client-accounts.md](client-accounts.md) | Connect Meta account, switch between clients |
| Reports | [reports.md](reports.md) | Export PDF/CSV |

## Suggested project layout

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── connect-meta/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           # client switcher in nav
│   │   ├── dashboard/page.tsx
│   │   ├── campaigns/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── reports/page.tsx
│   └── api/                     # Next.js route handlers, if proxying any backend calls
├── components/
│   ├── ui/                      # shared primitives
│   ├── charts/
│   ├── campaign-form/
│   └── client-switcher/
├── lib/
│   ├── api-client.ts            # typed wrapper around your NestJS backend
│   └── hooks/
└── package.json
```

## Data fetching pattern

Use React Query against your own NestJS backend — never call the Meta Graph API directly from the frontend. The frontend should have zero knowledge of Meta tokens; all of that stays server-side.

```typescript
// lib/hooks/useInsights.ts
export function useInsights(clientId: string, dateRange: DateRange) {
  return useQuery({
    queryKey: ['insights', clientId, dateRange],
    queryFn: () => apiClient.get(`/clients/${clientId}/insights`, { params: dateRange }),
  });
}
```
