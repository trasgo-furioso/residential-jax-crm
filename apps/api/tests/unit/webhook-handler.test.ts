import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ── Mock DuckDB ──────────────────────────────────────────────────────────────
vi.mock('../../src/services/duckdb.js', () => ({
  queryPropertiesByCriteria: vi.fn().mockResolvedValue([]),
}));

// ── Mock Drizzle db ──────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

vi.mock('../../src/lib/db/index.js', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: (...fArgs: unknown[]) => { mockFrom(...fArgs); return { where: mockWhere }; } };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return { values: mockValues };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return { set: (...sArgs: unknown[]) => { mockSet(...sArgs); return { where: vi.fn() }; } };
    },
  },
}));

// ── Mock Secrets Manager ─────────────────────────────────────────────────────
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetSecretValueCommand: vi.fn(),
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import {
  verifySignature,
  isDuplicate,
  processWebhookEvent,
} from '../../src/services/webhook-handler.js';
import { queryPropertiesByCriteria } from '../../src/services/duckdb.js';
import type { WebhookEvent } from '@crm/shared';

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    event_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    event_type: 'pipeline.run.completed',
    county: 'duval',
    run_id: '11111111-2222-3333-4444-555555555555',
    ipns_pointer: 'k51abc123',
    artifact_cid: 'bafybeiabc123',
    timestamp: '2026-08-22T12:00:00Z',
    delta: {
      new_count: 2,
      updated_count: 1,
      removed_count: 0,
      new_parcel_ids: ['P001', 'P002'],
      updated_parcel_ids: ['P003'],
      removed_parcel_ids: [],
    },
    ...overrides,
  };
}

describe('verifySignature', () => {
  const secret = 'test-secret-key';
  const body = JSON.stringify({ event_id: 'test' });

  it('returns true for a valid HMAC signature', () => {
    const sig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const badSig = 'a'.repeat(64);
    expect(verifySignature(body, badSig, secret)).toBe(false);
  });

  it('returns false when signature length mismatches', () => {
    expect(() => verifySignature(body, 'short', secret)).toThrow();
  });
});

describe('isDuplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when event_id already exists', async () => {
    mockWhere.mockResolvedValueOnce([{ event_id: 'existing-id' }]);
    const result = await isDuplicate('existing-id');
    expect(result).toBe(true);
  });

  it('returns false when event_id is new', async () => {
    mockWhere.mockResolvedValueOnce([]);
    const result = await isDuplicate('new-id');
    expect(result).toBe(false);
  });
});

describe('processWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockResolvedValue(undefined);
    mockWhere.mockResolvedValue([]);
  });

  it('inserts a pipeline_events record', async () => {
    const event = makeEvent();
    await processWebhookEvent(event);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: event.event_id,
        status: 'processing',
      }),
    );
  });

  it('queries saved criteria with notifications enabled', async () => {
    const event = makeEvent();
    // First mockWhere for savedCriteria query returns empty
    mockWhere.mockResolvedValueOnce([]);
    await processWebhookEvent(event);
    expect(mockFrom).toHaveBeenCalled();
  });

  it('matches delta parcel_ids against criteria and creates notifications', async () => {
    const event = makeEvent();
    // savedCriteria query returns one criteria
    mockWhere.mockResolvedValueOnce([
      {
        id: 'crit-001',
        name: 'Test Criteria',
        filters: { assessed_value_min: 100_000 },
        notifications_enabled: true,
      },
    ]);

    // DuckDB returns matching property
    vi.mocked(queryPropertiesByCriteria).mockResolvedValueOnce([
      { parcel_id: 'P001' } as any,
    ]);

    await processWebhookEvent(event);

    // Should have inserted a notification
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        criteria_id: 'crit-001',
        event_id: event.event_id,
        matched_count: 1,
      }),
    );
  });

  it('updates pipeline event status to completed', async () => {
    const event = makeEvent();
    mockWhere.mockResolvedValueOnce([]); // no criteria
    await processWebhookEvent(event);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('creates summary notifications for matched criteria', async () => {
    const event = makeEvent();
    mockWhere.mockResolvedValueOnce([
      {
        id: 'crit-001',
        name: 'Waterfront Deals',
        filters: { water_proximity_max_ft: 2000 },
        notifications_enabled: true,
      },
    ]);

    vi.mocked(queryPropertiesByCriteria).mockResolvedValueOnce([
      { parcel_id: 'P001' } as any,
      { parcel_id: 'P002' } as any,
    ]);

    await processWebhookEvent(event);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        criteria_id: 'crit-001',
        matched_count: 2,
        matched_parcel_ids: ['P001', 'P002'],
      }),
    );
  });
});
