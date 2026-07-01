# Campaign manager

## Overview

The write-access UI: create campaigns, configure ad sets and targeting, upload creative, and toggle status. This is the most complex frontend module — budget the most time here.

## Flow

A multi-step form mirrors Meta's object hierarchy:

1. **Campaign step** — name, objective (traffic, sales, leads, etc.)
2. **Ad set step** — budget, schedule, targeting (audience), placement
3. **Ad step** — creative upload, copy, call-to-action, destination URL
4. **Review step** — summary before submission, explicit "save as paused" confirmation

## Implementation

### Form with react-hook-form + zod

```tsx
const campaignSchema = z.object({
  name: z.string().min(1).max(100),
  objective: z.enum(['OUTCOME_TRAFFIC', 'OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_AWARENESS']),
});

function CampaignStep() {
  const { register, formState: { errors } } = useFormContext<CampaignFormData>();
  return (
    <div>
      <input {...register('name')} placeholder="Campaign name" />
      {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}
      <select {...register('objective')}>
        <option value="OUTCOME_TRAFFIC">Traffic</option>
        <option value="OUTCOME_SALES">Sales</option>
        <option value="OUTCOME_LEADS">Leads</option>
        <option value="OUTCOME_AWARENESS">Awareness</option>
      </select>
    </div>
  );
}
```

### Targeting picker

A searchable multi-select hitting your backend's proxy of Meta's targeting search endpoint (don't expose the Meta endpoint directly to the frontend):

```tsx
function InterestPicker({ value, onChange }: { value: Interest[]; onChange: (v: Interest[]) => void }) {
  const [query, setQuery] = useState('');
  const { data: suggestions } = useQuery({
    queryKey: ['targeting-search', query],
    queryFn: () => apiClient.get('/targeting/search', { params: { q: query } }),
    enabled: query.length > 2,
  });
  // render input + dropdown of suggestions, add to `value` array on select
}
```

### Budget input

Display in the client's account currency (fetched from the connection), convert to the smallest unit (cents) only when submitting to your backend. Show a live estimate of monthly spend based on daily budget to help non-technical clients sanity-check their input.

### Creative upload

```tsx
async function uploadCreativeImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await apiClient.post('/campaigns/upload-image', formData);
  return res.data.imageHash; // backend handles the Meta /adimages call
}
```

### Status controls

Pause/resume/delete buttons on the campaign list and detail view, each requiring a confirmation dialog before submission (especially delete — it's irreversible on Meta's side too).

### Validation feedback

Surface Meta's own validation errors (returned from your backend's error-normalized response, see [api-gateway.md](../02-backend/api-gateway.md)) inline next to the relevant form field where possible, rather than a generic toast — campaign creation errors are often specific (e.g. "daily budget below minimum for this currency").

## Estimated time

2-3 weeks. This is the largest frontend module by far — the multi-step form, targeting picker, and creative upload each take real time to get right.
