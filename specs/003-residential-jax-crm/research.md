# Research: Residential Property Acquisition CRM

**Date**: 2026-08-22 | **Feature**: specs/003-residential-jax-crm

## Map Library

**Decision**: MapLibre GL JS

**Rationale**: Open-source fork of Mapbox GL JS with no API key requirement. Supports clustering, GeoJSON overlays, polygon drawing, and smooth performance with large datasets. Free to use commercially. MapLibre React bindings (`react-map-gl` with MapLibre adapter) integrate well with Next.js.

**Alternatives considered**:
- Mapbox GL JS — excellent but requires API key and usage-based pricing, adds cost
- Leaflet — simpler but weaker performance with 200k+ markers, no native vector tile support
- Google Maps — requires API key, usage fees, less customizable

## Client-Side Property Querying

**Decision**: DuckDB-WASM reading Parquet directly from IPFS via httpfs

**Rationale**: The pipeline publishes a query-table Parquet file at `oracle-query-table-duval` IPNS label. DuckDB-WASM can read this directly in the browser via HTTP range requests, enabling SQL queries on ~245k properties without any server-side database. This satisfies FR-016 (no Oracle hosted-DB cost). The Parquet file is typically 10-50MB for 245k records with the schema defined in the pipeline data model.

**Alternatives considered**:
- Server-side DuckDB (Node.js) — works but adds server memory requirements; WASM keeps it stateless
- SQLite WASM — good but lacks Parquet httpfs support; would require data conversion
- Neon Postgres for property data — violates FR-016 (would shift DB cost to Oracle pipeline relationship)

## CRM State Persistence

**Decision**: Vercel Neon Postgres via Drizzle ORM

**Rationale**: The CRM needs to persist its own state (saved criteria, opportunities, notifications, outreach records) across sessions. Neon Postgres on Vercel's free/hobby tier provides a lightweight hosted DB for CRM-specific data. This is CRM's own cost, not Oracle's — the pipeline data stays on IPFS. Drizzle ORM provides type-safe schema and query building aligned with TypeScript-first approach.

**Alternatives considered**:
- SQLite on Vercel — Vercel doesn't support persistent file storage; SQLite would lose state between deployments
- Upstash Redis — good for simple key-value but awkward for relational CRM data (opportunity stages, outreach history)
- In-memory only — would lose all CRM state on page refresh; unacceptable for deal tracking

## Map Performance at Scale

**Decision**: MapLibre cluster layer with progressive loading

**Rationale**: 245k markers rendered individually would overwhelm the browser. MapLibre's built-in `cluster` source option groups nearby properties at low zoom levels, showing individual markers only when zoomed in. Properties are loaded as GeoJSON from DuckDB-WASM query results. For filtered views (after criteria search), the result set is typically hundreds to low thousands — well within direct rendering limits.

**Alternatives considered**:
- Server-side tile generation (MVT) — optimal for millions of points but adds server infrastructure
- Canvas-based rendering (deck.gl) — powerful but heavier dependency for this use case
- Pagination with viewport queries — viable but breaks the "see everything" map experience

## RAG Agent Architecture

**Decision**: Vercel AI SDK with DuckDB-WASM as a tool

**Rationale**: Constitution mandates Vercel AI SDK for all LLM interactions. The agent receives natural-language queries, translates them to SQL using a system prompt with the Parquet schema, executes via DuckDB-WASM, and returns results with provenance. This keeps the agent stateless and the data source consistent with the map/search layer.

**Alternatives considered**:
- OpenSearch/vector search — adds infrastructure and cost; overkill when DuckDB can handle structured property queries
- Direct LLM with all data in context — 245k records exceed context limits
- Pre-built embeddings — adds complexity; structured SQL queries are more deterministic for property attribute searches

## Webhook Processing

**Decision**: Next.js API route with sequential processing queue

**Rationale**: The pipeline sends webhook events (at-least-once) after publishing. The CRM webhook handler: (1) verifies HMAC signature, (2) deduplicates by event_id, (3) resolves the new artifact, (4) runs saved criteria against delta records, (5) generates summary notifications. Processing is sequential per the parent spec requirement. Neon Postgres stores event log for idempotency.

**Alternatives considered**:
- External queue (SQS, Redis) — adds infrastructure; webhook volume is low (one event per pipeline run)
- Polling IPNS — rejected in clarification; webhook is the chosen pattern
- Background worker — Next.js API routes can handle the processing inline for the expected volume (one event every few hours at most)

## Deployment

**Decision**: Vercel

**Rationale**: Constitution requires hosted runtime without local setup. Vercel provides zero-config deployment for Next.js with built-in Neon Postgres integration, edge functions, and automatic HTTPS. The free/hobby tier covers the expected single-user workload.

**Alternatives considered**:
- AWS Amplify — works but more setup friction for Next.js; Vercel is the native platform
- Self-hosted on EC2/ECS — adds infrastructure management; unnecessary for a demo/single-user CRM
- Cloudflare Pages — good but less mature Next.js support
