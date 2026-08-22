# Quickstart Validation Guide

**Date**: 2026-08-22 | **Feature**: specs/003-residential-jax-crm

## Prerequisites

- Node.js 20+
- Vercel account with Neon Postgres provisioned
- Access to Elephant IPFS (Filebase gateway) — the pipeline must have published at least one Duval County artifact
- `WEBHOOK_SECRET` shared with the pipeline operator
- `DATABASE_URL` from Vercel Neon

## Environment Setup

```bash
# Clone and install
git clone <repo-url>
cd residential-jax-crm
npm install

# Environment variables
cp .env.example .env.local
# Fill in:
#   DATABASE_URL=<neon postgres connection string>
#   WEBHOOK_SECRET=<shared secret with pipeline>
#   NEXT_PUBLIC_IPNS_OPEN_DATA=<IPNS key for oracle-open-data-duval>
#   NEXT_PUBLIC_IPNS_QUERY_TABLE=<IPNS key for oracle-query-table-duval>
#   OPENAI_API_KEY=<for RAG agent via Vercel AI SDK>

# Run migrations
npx drizzle-kit push

# Start dev server
npm run dev
```

## Validation Scenarios

### V1: Map loads with properties (US1, FR-001, FR-002)

1. Open `http://localhost:3000`
2. **Expected**: Map centered on Jacksonville/Duval County with clustered property markers
3. Zoom into a neighborhood (e.g., Arlington, zip 32211)
4. **Expected**: Individual property markers appear with parcel IDs
5. Click a property marker
6. **Expected**: Detail panel shows parcel ID, address, owner, assessed value, ownership tenure, roof age, coordinates, and source provenance
7. Switch to list view
8. **Expected**: Same properties in a sortable table

### V2: Criteria search and save (US2, FR-004, FR-005, FR-006)

1. Open the search/criteria panel
2. Set filters: ownership tenure > 10 years, roof age > 15 years, zip code 32210
3. Click "Search"
4. **Expected**: Matching properties appear on map and in ranked list with percentage match score (e.g., "3/3 criteria met, 100%") and per-criterion breakdown
5. Click "Save Search", name it "Arlington Distressed"
6. **Expected**: Saved search appears in the saved-searches list
7. Clear filters, then select "Arlington Distressed" from saved list
8. **Expected**: Criteria re-applied, same results displayed

### V3: Webhook and proactive notification (US3, FR-007, FR-008)

1. Simulate a pipeline webhook by sending a POST to `/api/webhook/pipeline`:
```bash
# Compute signature
BODY='{"event_id":"test-001","event_type":"artifact.published","county":"duval","run_id":"run-001","ipns_pointer":"<real-ipns-key>","artifact_cid":"<real-cid>","timestamp":"2026-08-22T12:00:00Z","delta":{"new_count":5,"updated_count":2,"removed_count":0,"new_parcel_ids":["<real-parcel-id>"],"updated_parcel_ids":[],"removed_parcel_ids":[]}}'

SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

curl -X POST http://localhost:3000/api/webhook/pipeline \
  -H "Content-Type: application/json" \
  -H "X-Event-Id: test-001" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$BODY"
```
2. **Expected**: 200 OK with `{"status":"accepted"}`
3. Open the CRM notification panel
4. **Expected**: Summary notification: "X new matches for 'Arlington Distressed'" (if the delta parcel IDs match the saved criteria)
5. Click the notification
6. **Expected**: Navigate to matched properties

### V4: Create and track opportunity (US4, FR-009, FR-010)

1. From a property detail, click "Create Opportunity"
2. **Expected**: Opportunity created at stage "Identified"
3. Add owner contact details, asking price $180,000, offer $150,000, and a note
4. Advance stage to "Contacted"
5. **Expected**: Stage change recorded with timestamp, notes persisted
6. Assign a task: "Follow up call" to VA, due in 3 days
7. **Expected**: Task appears in task list
8. Open Opportunities page, filter by stage "Contacted"
9. **Expected**: Only opportunities at "Contacted" stage shown

### V5: Mocked outreach (US5, FR-011)

1. From an opportunity, click "Send Email" (mocked)
2. **Expected**: Outreach record created with status "Sent"
3. Wait or trigger simulated lifecycle progression
4. **Expected**: Status advances to "Delivered", then eventually "Replied" or "Bounced"
5. View outreach history on the opportunity
6. **Expected**: All outreach attempts listed with channel, timestamp, status

### V6: Agent query (US6, FR-013)

1. Open the agent chat interface
2. Type: "Show distressed properties in Arlington with roofs older than 15 years that have not sold in 10+ years"
3. **Expected**: Agent returns matching properties with match rationale and source references
4. Click a result
5. **Expected**: Navigate to property detail view

### V7: Export (US7, FR-014)

1. Filter opportunities to a subset
2. Click "Export"
3. **Expected**: CSV file downloads with all selected records and complete attributes

### V8: End-to-end demo flow (SC-002)

Run V2 → V3 → V4 → V5 in sequence without leaving the CRM.
**Expected**: The full acquisition workflow completes in a single session.

## Deployment Validation

```bash
# Deploy to Vercel
vercel deploy --prod

# Verify hosted runtime
curl https://<deployed-url>/api/webhook/pipeline -I
# Expected: 405 Method Not Allowed (GET not accepted, only POST)

# Run the same V1-V8 scenarios against the deployed URL
```
