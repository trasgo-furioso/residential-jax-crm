import { processWebhookEvent, verifySignature, isDuplicate } from '@/services/webhook-handler.js';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';

const logger = new Logger({ serviceName: 'ResidentialCRM' });
const tracer = new Tracer({ serviceName: 'ResidentialCRM' });
const metrics = new Metrics({ serviceName: 'ResidentialCRM', namespace: 'ResidentialCRM' });

export const handler = async (event: { body?: string; headers?: Record<string, string> }) => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('## webhook-handler-raw');
  if (subsegment) tracer.setSegment(subsegment);

  try {
    const body = event.body || '';
    const signature =
      event.headers?.['x-webhook-signature'] ||
      event.headers?.['X-Webhook-Signature'] ||
      '';
    const secret = process.env.WEBHOOK_SECRET || '';

    // Verify HMAC
    if (!verifySignature(body, signature, secret)) {
      metrics.addMetric('WebhookAuthFailed', 'Count', 1);
      return { statusCode: 401, body: JSON.stringify({ error: 'invalid_signature' }) };
    }

    const payload = JSON.parse(body);

    // Dedup
    const duplicate = await isDuplicate(payload.event_id);
    if (duplicate) {
      metrics.addMetric('WebhookDuplicate', 'Count', 1);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'duplicate', event_id: payload.event_id }),
      };
    }

    // Process
    await processWebhookEvent(payload, logger, metrics);
    metrics.publishStoredMetrics();
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'accepted', event_id: payload.event_id }),
    };
  } catch (err) {
    logger.error('Webhook processing failed', { error: err });
    metrics.addMetric('WebhookError', 'Count', 1);
    metrics.publishStoredMetrics();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'processing_failed' }),
    };
  } finally {
    if (subsegment) {
      subsegment.close();
      tracer.setSegment(segment!);
    }
  }
};
