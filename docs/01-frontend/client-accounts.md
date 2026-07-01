# Client accounts

## Overview

Two related UIs: the "connect Meta account" onboarding flow, and the multi-client account switcher in the main nav (for agencies/teams managing several clients).

## Connect flow

```tsx
function ConnectMetaButton() {
  return (
    <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/meta/connect`} className="btn-primary">
      Connect Meta account
    </a>
  );
}
```

This is a plain link, not a fetch call — it needs to do a full page redirect to Meta's OAuth dialog. After Meta redirects back to your backend's callback (see [auth-service.md](../02-backend/auth-service.md)), have the backend redirect the browser to a frontend success/error page, e.g. `/connect-meta/success` or `/connect-meta/error?reason=...`.

### Post-connect: asset selection

After the OAuth grant, the client may manage multiple ad accounts or pages. Show a selection screen rather than assuming the first one:

```tsx
function SelectAssetsStep({ adAccounts, pages }: AssetOptions) {
  // checkboxes for which ad accounts / pages to actually activate in the platform
  // submits to backend, which stores the selection in MetaAsset records
}
```

### Connection status indicator

Persistent small indicator (in settings or nav) showing connection health: connected / needs reconnect / never connected. Poll or fetch this on each dashboard load — surfacing a stale "needs reconnect" state quickly prevents the client from staring at an empty dashboard wondering why.

## Client switcher (multi-tenant nav)

```tsx
function ClientSwitcher() {
  const { data: clients } = useQuery({ queryKey: ['my-clients'], queryFn: () => apiClient.get('/clients') });
  const [activeClientId, setActiveClientId] = useAtom(activeClientIdAtom); // or your state mgmt of choice

  return (
    <select value={activeClientId} onChange={(e) => setActiveClientId(e.target.value)}>
      {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
```

Only build this if your platform actually serves users who manage multiple clients (e.g. an agency). If every login maps to exactly one client, skip this and simplify — don't build multi-tenancy switching UI you don't need yet.

## Estimated time

3-4 days for the connect flow and asset selection, 2-3 days for the switcher if needed.
