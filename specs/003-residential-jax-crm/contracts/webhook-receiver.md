# Contract: Webhook Receiver

**Consumer**: This CRM (receives events)
**Producer**: Oracle Pipeline publish step (sends events)

## Endpoint

```
POST /api/webhook/pipeline
```

## Request (from Pipeline)

Defined in `specs/002-oracle-pipeline-duval/contracts/webhook-event.md`. The CRM receives:

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "artifact.published",
  "county": "duval",
  "run_id": "660e8400-e29b-41d4-a716-446655440001",
  "ipns_pointer": "k51qzi5uqu5d...",
  "artifact_cid": "bafybeig...",
  "timestamp": "2026-08-20T14:30:00.000Z",
  "delta": {
    "new_count": 142,
    "updated_count": 38,
    "removed_count": 0,
    "new_parcel_ids": ["RE0001234", "RE0001235"],
    "updated_parcel_ids": ["RE0009876"],
    "removed_parcel_ids": []
  }
}
```

## Headers

```
Content-Type: application/json
X-Event-Id: <event_id>
X-Webhook-Signature: <HMAC-SHA256 of body with WEBHOOK_SECRET>
```

## Response

### Success (event accepted)

```
HTTP 200 OK
Content-Type: application/json

{ "status": "accepted", "event_id": "550e8400-..." }
```

### Duplicate (already processed)

```
HTTP 200 OK
Content-Type: application/json

{ "status": "duplicate", "event_id": "550e8400-..." }
```

### Signature Failure

```
HTTP 401 Unauthorized
Content-Type: application/json

{ "error": "invalid_signature" }
```

### Server Error

```
HTTP 500 Internal Server Error
Content-Type: application/json

{ "error": "processing_failed", "event_id": "550e8400-..." }
```

## Processing Flow

1. **Verify signature**: Compute `HMAC-SHA256(request_body, WEBHOOK_SECRET)` and compare with `X-Webhook-Signature`. Reject with 401 on mismatch.
2. **Deduplicate**: Check `pipeline_events` table for existing `event_id`. If found, return 200 with `"duplicate"`.
3. **Store event**: Insert into `pipeline_events` with status `pending`.
4. **Process artifact**: Resolve IPNS pointer, extract delta parcel IDs.
5. **Match criteria**: For each saved criteria set with `notifications_enabled = true`, evaluate delta parcel IDs against the criteria using DuckDB-WASM on the new Parquet.
6. **Generate notifications**: For each criteria set with matches, create a single summary notification.
7. **Mark complete**: Update `pipeline_events` status to `completed`.

## Environment Variables

```
WEBHOOK_SECRET=<shared secret for HMAC verification>
```

## Idempotency

The receiver MUST be idempotent. The pipeline delivers at-least-once. Deduplication is by `event_id` in the `pipeline_events` table.

## Sequential Processing

Per parent spec, the CRM processes every artifact sequentially in order of webhook receipt. No skipping to latest.
