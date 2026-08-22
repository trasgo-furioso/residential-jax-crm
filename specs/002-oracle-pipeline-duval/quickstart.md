# Quickstart: Oracle Pipeline — Duval County

**Date**: 2026-08-20 | **Feature**: specs/002-oracle-pipeline-duval

## Prerequisites

- Node.js 22.18+
- Docker + Docker Compose (for Restate + Postgres)
- Filebase account with S3 credentials
- AWS account (for CDK deployment)
- Duval County parcel seed CSV

## Environment Setup

```bash
# Clone and install
cd oracle-property-intelligence-platform-pipeline-duval-fl
npm install

# Configure environment
cp .env.example .env
# Fill: FILEBASE_ACCESS_KEY, FILEBASE_SECRET_KEY, WEBHOOK_URLS, AWS credentials
```

## Local Development

```bash
# Start infrastructure (Restate + Postgres)
docker compose up -d

# Register services with Restate
npm run dev
npm run register

# Run a pilot ingestion (25 parcels)
npm run ingest -- --county duval --limit 25
```

## Deployment (Prerequisite — must be done first)

```bash
# Deploy infrastructure via CDK
cd infra
npx cdk deploy --all

# Deploy frontend
cd ../frontend
npm run build
# Amplify auto-deploys from connected branch

# Deploy pipeline services
cd ../pipeline
npm run build
# Push to EC2/ECS via CDK or container registry
```

## Validation Scenarios

### 1. Continuous Incremental Ingestion

```bash
# Run 1: Initial ingestion
npm run ingest -- --county duval

# Verify: Records loaded with provenance
npm run query -- "SELECT COUNT(*), COUNT(DISTINCT source) FROM properties"

# Run 2: Incremental update (after source data changes)
npm run ingest -- --county duval

# Verify: Delta shows new/updated counts, no duplicates
npm run query -- "SELECT delta_new, delta_updated FROM pipeline_runs ORDER BY completed_at DESC LIMIT 1"
```

**Expected**: Run 2 shows non-zero deltas; total record count increases; no duplicate parcel IDs.

### 2. IPFS Publishing

```bash
# Publish (after ingestion)
npm run publish -- --county duval

# Verify: CID created, IPNS updated
curl -I https://ipfs.filebase.io/ipns/<duval-ipns-key>/index.json
```

**Expected**: HTTP 200; `index.json` contains correct property_count and run_id.

### 3. Webhook Delivery

```bash
# Use a webhook test service (e.g., webhook.site)
# Set WEBHOOK_URLS in .env

# Trigger publish
npm run publish -- --county duval

# Verify: Webhook received with correct payload
```

**Expected**: POST received within 30s with `event_type: artifact.published`, valid delta counts.

### 4. Property Intelligence Queries (UI)

Open the deployed UI at `https://<deployed-url>`.

1. Search: "properties with roofs older than 15 years" → results with permit evidence
2. Search: "properties with a view of water" → results with proximity data
3. Search: "properties not sold in 10+ years" → results with ownership history
4. Search: "properties with regional owners" → results with owner address comparison
5. Search: "properties near public transit" → results with distance calculations
6. Search: "properties near Starbucks" → results with distance calculations

**Expected**: Each query returns results with source provenance and evidence basis.

### 5. Agent Queries

In the UI agent chat:
```
"Which properties have roofs older than 15 years and have not exchanged ownership in more than 10 years?"
```

**Expected**: Agent returns matching properties with source-backed evidence and reasoning, within 10 seconds.

### 6. MCP Access

```bash
# Start MCP server pointing at Duval IPNS
ORACLE_OPEN_DATA_IPNS_MAP='{"duval":"<ipns-key>"}' npm run mcp:start

# Query via MCP client
# listOracleProperties { county: "duval", limit: 10 }
# queryProperties { county: "duval", sql: "SELECT * FROM properties WHERE roof_age_years > 15 LIMIT 5" }
```

**Expected**: MCP returns results without any hosted database.

### 7. Pipeline Run History (UI)

Open `https://<deployed-url>/runs`.

**Expected**: Chronological list of runs with timestamps, source lists, record counts, deltas, and any source limitations. At least 2 runs visible.
