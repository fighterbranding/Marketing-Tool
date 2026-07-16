import type { Response, Request } from 'express';
import type { Queue } from 'bullmq';
import { WebhooksController } from './webhooks.controller';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let webhooksService: { verifySignature: jest.Mock };
  let queue: { add: jest.Mock };
  let res: { status: jest.Mock; send: jest.Mock; sendStatus: jest.Mock };

  beforeEach(() => {
    webhooksService = { verifySignature: jest.fn() };
    queue = { add: jest.fn() };
    controller = new WebhooksController(
      webhooksService,
      queue as unknown as Queue,
    );
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      sendStatus: jest.fn().mockReturnThis(),
    };
  });

  describe('verify', () => {
    it('echoes the challenge when mode and token are correct', () => {
      process.env.META_WEBHOOK_VERIFY_TOKEN = 'secret-token';

      controller.verify(
        'subscribe',
        'secret-token',
        'challenge-123',
        res as unknown as Response,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('challenge-123');
    });

    it('rejects with 403 when the token does not match', () => {
      process.env.META_WEBHOOK_VERIFY_TOKEN = 'secret-token';

      controller.verify(
        'subscribe',
        'wrong-token',
        'challenge-123',
        res as unknown as Response,
      );

      expect(res.sendStatus).toHaveBeenCalledWith(403);
    });

    it('rejects with 403 when mode is not "subscribe"', () => {
      process.env.META_WEBHOOK_VERIFY_TOKEN = 'secret-token';

      controller.verify(
        'unsubscribe',
        'secret-token',
        'challenge-123',
        res as unknown as Response,
      );

      expect(res.sendStatus).toHaveBeenCalledWith(403);
    });
  });

  describe('receive', () => {
    it('rejects with 403 and does not queue when the signature is invalid', async () => {
      webhooksService.verifySignature.mockReturnValue(false);
      const req = { rawBody: Buffer.from('{}') } as Request & {
        rawBody?: Buffer;
      };

      await controller.receive(
        { foo: 'bar' },
        'sha256=bad',
        req,
        res as unknown as Response,
      );

      expect(res.sendStatus).toHaveBeenCalledWith(403);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('acknowledges with 200 and queues the payload when the signature is valid', async () => {
      webhooksService.verifySignature.mockReturnValue(true);
      const req = { rawBody: Buffer.from('{"foo":"bar"}') } as Request & {
        rawBody?: Buffer;
      };

      await controller.receive(
        { foo: 'bar' },
        'sha256=good',
        req,
        res as unknown as Response,
      );

      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(queue.add).toHaveBeenCalledWith('process-event', { foo: 'bar' });
    });

    it('rejects with 400 and does not queue when the payload is not an object', async () => {
      webhooksService.verifySignature.mockReturnValue(true);
      const req = { rawBody: Buffer.from('"just a string"') } as Request & {
        rawBody?: Buffer;
      };

      await controller.receive(
        'just a string',
        'sha256=good',
        req,
        res as unknown as Response,
      );

      expect(res.sendStatus).toHaveBeenCalledWith(400);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('returns 500 and does not acknowledge success when queueing fails', async () => {
      webhooksService.verifySignature.mockReturnValue(true);
      queue.add.mockRejectedValue(new Error('redis unavailable'));
      const req = { rawBody: Buffer.from('{"foo":"bar"}') } as Request & {
        rawBody?: Buffer;
      };

      await controller.receive(
        { foo: 'bar' },
        'sha256=good',
        req,
        res as unknown as Response,
      );

      expect(res.sendStatus).toHaveBeenCalledWith(500);
      expect(res.sendStatus).not.toHaveBeenCalledWith(200);
    });

    it('queues before acknowledging, so a queue failure never yields a 200', async () => {
      webhooksService.verifySignature.mockReturnValue(true);
      const callOrder: string[] = [];
      queue.add.mockImplementation(() => {
        callOrder.push('queue');
        return Promise.resolve();
      });
      res.sendStatus.mockImplementation((code: number) => {
        callOrder.push(`ack:${code}`);
        return res;
      });
      const req = { rawBody: Buffer.from('{"foo":"bar"}') } as Request & {
        rawBody?: Buffer;
      };

      await controller.receive(
        { foo: 'bar' },
        'sha256=good',
        req,
        res as unknown as Response,
      );

      expect(callOrder).toEqual(['queue', 'ack:200']);
    });
  });
});
