import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class WebhooksService {
  verifySignature(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): boolean {
    if (!rawBody || !signature) return false;

    const expected =
      'sha256=' +
      createHmac('sha256', process.env.META_APP_SECRET ?? '')
        .update(rawBody)
        .digest('hex');

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    // timingSafeEqual throws on mismatched lengths, so compare lengths
    // first rather than letting a malformed header crash the request.
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
