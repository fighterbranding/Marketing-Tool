# Webhooks

## Overview

Meta can push real-time events to your app instead of you polling for changes — useful for things like ad account status changes, campaign budget alerts, or (if you add WhatsApp Cloud API messaging later) incoming message notifications. This is lower priority than auth/sync/insights — build it in Phase 5, not before.

## Implementation steps

### 1. Verification endpoint (required by Meta)

Meta calls this endpoint once when you register a webhook, to confirm you control it.

```typescript
@Get('webhooks/meta')
verify(
  @Query('hub.mode') mode: string,
  @Query('hub.verify_token') token: string,
  @Query('hub.challenge') challenge: string,
  @Res() res: Response,
) {
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}
```

`META_WEBHOOK_VERIFY_TOKEN` is a string you choose yourself and enter in the App Dashboard webhook config — it's not issued by Meta.

### 2. Receiving events

```typescript
@Post('webhooks/meta')
async receive(@Body() payload: any, @Headers('x-hub-signature-256') signature: string, @Res() res: Response) {
  if (!this.verifySignature(payload, signature)) {
    return res.sendStatus(403);
  }
  res.sendStatus(200); // acknowledge immediately, process async

  await this.webhookQueue.add('process-event', payload);
}
```

**Acknowledge within a few seconds, always.** Meta will retry and eventually disable your webhook if you're slow or return errors — push the actual processing onto a queue rather than doing it inline.

### 3. Signature verification

Confirms the payload actually came from Meta, not a spoofed request.

```typescript
verifySignature(payload: any, signature: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### 4. Subscribe to specific fields

In the App Dashboard, under Webhooks, subscribe only to the fields you'll act on (e.g. `campaigns` for status changes). Don't subscribe broadly — it adds noise and unnecessary review scope.

## Estimated time

2-3 days.
