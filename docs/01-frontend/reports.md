# Reports

## Overview

Exportable PDF/CSV reports — typically what agencies send to their own clients to show campaign performance. Lower priority than the dashboard itself (Phase 6 in the blueprint), but valued highly by agency-type users since it's literally their client deliverable.

## CSV export

Simplest to build — generate directly from the same data the dashboard already queries.

```typescript
// backend: reports.controller.ts
@Get('reports/csv')
async exportCsv(@Query() params: ReportQueryDto, @Res() res: Response) {
  const data = await this.insightsService.getMetrics(params);
  const csv = this.csvService.generate(data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
  res.send(csv);
}
```

## PDF export

Two viable approaches:

**Server-side render with Puppeteer** — render an HTML report template (can reuse your dashboard's chart components server-side via a headless render) and print to PDF. More setup, but visually matches your in-app dashboard exactly.

**React-pdf** — build the report as a dedicated React-pdf component tree, independent of your dashboard UI. Less visual fidelity to the live dashboard, but no headless browser dependency, which simplifies deployment.

For an MVP, recommend react-pdf — avoids the operational overhead of running Puppeteer in production (memory-heavy, needs careful sandboxing).

```tsx
import { Document, Page, Text, View } from '@react-pdf/renderer';

function CampaignReport({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4">
        <View>
          <Text>Campaign performance: {data.clientName}</Text>
          <Text>{data.dateRange}</Text>
        </View>
        {/* KPI summary, table rows */}
      </Page>
    </Document>
  );
}
```

## Branding

Agencies will likely want their own logo/colors on exported reports rather than your platform's branding — worth a simple settings field (logo upload, accent color) even in the MVP if your target users are agencies reselling to their own clients.

## Scheduled/recurring reports

Out of scope for MVP — note it here as a clear Phase 7+ item (weekly/monthly auto-emailed reports) rather than building it prematurely.

## Estimated time

1 week for CSV + basic PDF export.
