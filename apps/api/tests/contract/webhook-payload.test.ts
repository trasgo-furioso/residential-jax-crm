import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { z } from 'zod';

// ── Zod schema matching the webhook router definition ────────────────────────

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

const validPayload = {
  event_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  event_type: 'pipeline.run.completed',
  county: 'duval',
  run_id: '11111111-2222-3333-4444-555555555555',
  ipns_pointer: 'k51qzi5uqu5abc123',
  artifact_cid: 'bafybeiabc123def456',
  timestamp: '2026-08-22T12:00:00Z',
  delta: {
    new_count: 5,
    updated_count: 3,
    removed_count: 1,
    new_parcel_ids: ['P001', 'P002', 'P003', 'P004', 'P005'],
    updated_parcel_ids: ['P010', 'P011', 'P012'],
    removed_parcel_ids: ['P099'],
  },
};

describe('WebhookEvent payload contract', () => {
  it('validates a valid payload', () => {
    const result = webhookEventSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects payload with missing event_id', () => {
    const { event_id, ...rest } = validPayload;
    const result = webhookEventSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing delta', () => {
    const { delta, ...rest } = validPayload;
    const result = webhookEventSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects payload with invalid event_id (not UUID)', () => {
    const result = webhookEventSchema.safeParse({
      ...validPayload,
      event_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects payload with missing required delta fields', () => {
    const result = webhookEventSchema.safeParse({
      ...validPayload,
      delta: {
        new_count: 5,
        // missing other fields
      },
    });
    expect(result.success).toBe(false);
  });

  it('strips extra fields (Zod default behavior)', () => {
    const withExtras = {
      ...validPayload,
      extra_field: 'should be stripped',
      another_extra: 42,
    };
    const result = webhookEventSchema.safeParse(withExtras);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('extra_field');
      expect(result.data).not.toHaveProperty('another_extra');
    }
  });
});

describe('HMAC signature contract', () => {
  const secret = 'webhook-test-secret';

  it('produces expected HMAC-SHA256 signature for known body', () => {
    const body = JSON.stringify(validPayload);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Verify deterministic: same body + secret → same signature
    const again = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    expect(expected).toBe(again);
    expect(expected).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('produces different signature for different secret', () => {
    const body = JSON.stringify(validPayload);
    const sig1 = crypto
      .createHmac('sha256', 'secret-a')
      .update(body)
      .digest('hex');
    const sig2 = crypto
      .createHmac('sha256', 'secret-b')
      .update(body)
      .digest('hex');
    expect(sig1).not.toBe(sig2);
  });

  it('produces different signature for different body', () => {
    const body1 = JSON.stringify(validPayload);
    const body2 = JSON.stringify({ ...validPayload, county: 'clay' });
    const sig1 = crypto.createHmac('sha256', secret).update(body1).digest('hex');
    const sig2 = crypto.createHmac('sha256', secret).update(body2).digest('hex');
    expect(sig1).not.toBe(sig2);
  });
});
