import { createHmac } from 'node:crypto';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  const secret = 'test-secret';

  beforeEach(() => {
    process.env.META_APP_SECRET = secret;
    service = new WebhooksService();
  });

  function sign(body: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  }

  describe('verifySignature', () => {
    it('accepts a signature computed over the exact raw body', () => {
      const raw = Buffer.from('{"object":"page","entry":[]}');
      const signature = sign(raw.toString());

      expect(service.verifySignature(raw, signature)).toBe(true);
    });

    it('rejects a signature computed over different bytes', () => {
      const raw = Buffer.from('{"object":"page","entry":[]}');
      const signature = sign('{"object":"page","entry":[1]}');

      expect(service.verifySignature(raw, signature)).toBe(false);
    });

    it('rejects when the signature header is missing', () => {
      const raw = Buffer.from('{}');

      expect(service.verifySignature(raw, undefined)).toBe(false);
    });

    it('rejects when the raw body is missing', () => {
      expect(service.verifySignature(undefined, 'sha256=abc')).toBe(false);
    });

    it('does not throw on a malformed/short signature header', () => {
      const raw = Buffer.from('{}');

      expect(() => service.verifySignature(raw, 'not-hex')).not.toThrow();
      expect(service.verifySignature(raw, 'not-hex')).toBe(false);
    });
  });
});
