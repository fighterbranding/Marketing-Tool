import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/meta')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    @InjectQueue('meta-webhooks') private readonly webhookQueue: Queue,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (
      mode === 'subscribe' &&
      token === process.env.META_WEBHOOK_VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  @Post()
  async receive(
    @Body() payload: unknown,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ) {
    if (!this.webhooksService.verifySignature(req.rawBody, signature)) {
      return res.sendStatus(403);
    }
    if (typeof payload !== 'object' || payload === null) {
      return res.sendStatus(400);
    }
    try {
      // Queue before acknowledging — if this fails, a 5xx tells Meta to
      // retry delivery. Acking first would tell Meta "received" for an
      // event that was never actually queued, losing it silently.
      await this.webhookQueue.add('process-event', payload);
    } catch {
      return res.sendStatus(500);
    }
    return res.sendStatus(200);
  }
}
