import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from './trpc.js';
import {
  verifySignature,
  isDuplicate,
  processWebhookEvent,
} from '@/services/webhook-handler.js';

const deltaSchema = z.object({
  new_count: z.number(),
  updated_count: z.number(),
  removed_count: z.number(),
  new_parcel_ids: z.array(z.string()),
  updated_parcel_ids: z.array(z.string()),
  removed_parcel_ids: z.array(z.string()),
});

const webhookEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string(),
  county: z.string(),
  run_id: z.string().uuid(),
  ipns_pointer: z.string(),
  artifact_cid: z.string(),
  timestamp: z.string(),
  delta: deltaSchema,
});

export const webhookRouter = router({
  receive: publicProcedure
    .input(webhookEventSchema)
    .mutation(async ({ input, ctx }) => {
      const { logger, metrics, event: lambdaEvent } = ctx;

      logger.info('Webhook received', {
        event_id: input.event_id,
        event_type: input.event_type,
      });

      // Verify HMAC signature
      const secret = process.env.WEBHOOK_SECRET;
      if (!secret) {
        logger.error('WEBHOOK_SECRET not configured');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Webhook secret not configured',
        });
      }

      const signature =
        lambdaEvent?.headers?.['x-webhook-signature'] ??
        lambdaEvent?.headers?.['X-Webhook-Signature'] ??
        '';

      if (!signature) {
        logger.warn('Missing webhook signature');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'invalid_signature',
        });
      }

      const rawBody = JSON.stringify(input);
      if (!verifySignature(rawBody, signature, secret)) {
        logger.warn('Invalid webhook signature', { event_id: input.event_id });
        metrics.addMetric('WebhookFailed', 'Count', 1);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'invalid_signature',
        });
      }

      // Check for duplicate
      const duplicate = await isDuplicate(input.event_id);
      if (duplicate) {
        logger.info('Duplicate webhook event', { event_id: input.event_id });
        return { status: 'duplicate' as const, event_id: input.event_id };
      }

      // Process the event
      try {
        await processWebhookEvent(input, logger, metrics);
        return { status: 'accepted' as const, event_id: input.event_id };
      } catch (error) {
        logger.error('Webhook processing failed', {
          event_id: input.event_id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'processing_failed',
        });
      }
    }),
});
