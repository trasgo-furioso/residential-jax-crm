# Research: Oracle Pipeline — Duval County

**Date**: 2026-08-20 | **Feature**: specs/002-oracle-pipeline-duval

## Deployment Strategy

- **Decision**: EC2 (t3.large, us-east-2) running Docker Compose (Restate + Postgres + pipeline services) with Nginx/HTTPS + Amplify for React frontend + Lambda for agent/MCP
- **Rationale**: Slowking evaluator requires a deployed hosted runtime exercisable via Playwright. EC2 + Docker Compose mirrors the oracle-node pattern exactly (kit conformance). Amplify provides zero-config frontend hosting with CDK. Lambda for stateless agent/MCP endpoints. Single `npx cdk deploy --all` creates everything. Cost: ~$25-50/mo.
- **Alternatives considered**: ECS Fargate (more complex CDK, Restate persistent state harder to manage); Vercel (frontend only, no Docker); Railway (no CDK); Restate Cloud (may not be available, adds dependency)

## Pipeline Architecture

- **Decision**: Follow oracle-node pattern with Restate durable workflows
- **Rationale**: The elephant-xyz/skills prescribe a specific pipeline architecture using Restate for durable workflow orchestration. Following this pattern ensures kit conformance (5 pts) and alignment with the Oracle agent's prescribed workflow.
- **Alternatives considered**: Step Functions (more AWS-native but not prescribed by skills); plain Node.js scripts (not durable, no retry/resume)

## Data Source Strategy for Duval County

- **Decision**: Start with Duval County Property Appraiser portal as primary source; add permit, ownership, business, contractor, and geo data incrementally
- **Rationale**: The appraiser portal is the richest source with property details, assessed values, ownership history, and building characteristics. Permits provide roof age signals. Geo data provides coordinates for proximity queries.
- **Alternatives considered**: Starting with all sources simultaneously (higher risk, harder to debug)

## IPFS Publishing

- **Decision**: Filebase with per-county buckets, IPNS pointers, CIDv1+SHA-256
- **Rationale**: Prescribed by elephant-xyz/skills. Filebase provides S3-compatible API so we use `@aws-sdk/client-s3` (already approved). Per-county buckets prevent data clobbering.
- **Alternatives considered**: Pinata (used for other purposes in protocol but not for open-data publishing)

## Natural Language Agent

- **Decision**: Vercel AI SDK with DuckDB tool calling over published Parquet
- **Rationale**: Golden Path mandates Vercel AI SDK. DuckDB can read Parquet over HTTP (httpfs), which aligns with the zero-hosted-cost requirement — the agent queries published IPFS data directly.
- **Alternatives considered**: LangChain (forbidden by Golden Path); direct OpenAI SDK (forbidden)

## Proximity Queries (Transit, Starbucks)

- **Decision**: Pre-compute distances using publicly available GTFS feeds (transit) and Overpass/OSM data (Starbucks locations), store as derived attributes on property records
- **Rationale**: Avoids paid API dependencies. GTFS data is freely available for JTA (Jacksonville Transit Authority). OSM data covers Starbucks locations. Pre-computation at ingestion time keeps queries fast.
- **Alternatives considered**: Google Places API (paid, violates zero-cost principle); real-time distance calculation (too slow for batch queries)

## Water View Determination

- **Decision**: Use NHD (National Hydrography Dataset) waterline data + parcel geometry proximity. Flag properties within 500ft of water bodies.
- **Rationale**: NHD is freely available from USGS. Combined with parcel coordinates, straight-line distance to nearest water body is computable. Not as accurate as visual inspection but sufficient for a signal.
- **Alternatives considered**: Satellite imagery analysis (complex, slow, not needed for MVP); waterfront zoning codes (incomplete, county-specific)

## Webhook Extension

- **Decision**: Add webhook dispatch to the Publish virtual object's post-IPNS-update flow
- **Rationale**: The spec requires webhook signaling to the CRM. The Publish object already has a tick mechanism that runs after IPNS re-pointing — adding a webhook call after successful IPNS update is the natural extension point.
- **Alternatives considered**: Separate webhook service (over-engineered for a single consumer); SNS/SQS (adds AWS dependency for a simple POST)

## Delta Metadata

- **Decision**: Leverage Loader watermark to compute deltas; include delta manifest in published artifact alongside full snapshot
- **Rationale**: The Loader virtual object already tracks content-aware changes via watermarks. We can diff the current snapshot against the previous run's manifest to produce new/updated/removed lists. Published as `delta.json` alongside `index.json`.
- **Alternatives considered**: Storing deltas in a separate database (violates zero-cost); computing deltas from CID comparison (more complex, less reliable)
