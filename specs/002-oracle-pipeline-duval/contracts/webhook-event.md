# Contract: Webhook Event

**Consumer**: Residential CRM (R2)
**Producer**: Oracle Pipeline publish step

## Trigger

Sent after the pipeline successfully publishes a new artifact to Elephant IPFS and re-points the IPNS pointer.

## Endpoint

The pipeline sends an HTTP POST to each registered webhook URL.

## Payload

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
X-Webhook-Signature: <HMAC-SHA256 of body with shared secret>
```

## Delivery Guarantees

- **At-least-once**: The pipeline retries on failure (3 attempts with exponential backoff: 5s, 30s, 120s)
- **Idempotent consumers**: Consumers MUST handle duplicate events (use `event_id` for deduplication)
- **Non-blocking**: Webhook failure does NOT block the pipeline run from being considered successful
- **Timeout**: 10 seconds per attempt

## Registration

Webhook URLs are configured via environment variable:
```
WEBHOOK_URLS=https://crm.example.com/webhook/pipeline
```

Multiple URLs separated by commas for multiple consumers.

## Verification

Consumers verify authenticity via HMAC-SHA256 signature:
```
signature = HMAC-SHA256(request_body, WEBHOOK_SECRET)
```
