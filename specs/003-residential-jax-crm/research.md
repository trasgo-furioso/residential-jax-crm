# Research: Residential Property Acquisition CRM

**Date**: 2026-08-22 | **Feature**: specs/003-residential-jax-crm

## Project Architecture

**Decision**: Turborepo monorepo with tRPC + Lambda backend and Next.js Amplify frontend

**Rationale**: Constitution mandates AWS as primary cloud with CDK as the only IaC tool. The `metagross` agent and `build-frontend-backends` skill prescribe a Turborepo monorepo with `apps/web/` (Amplify), `apps/api/` (tRPC + Lambda + CDK), and shared `packages/`. This is the Golden Path standard — no adaptation needed.

**Alternatives considered**:
- Vercel (Next.js native) — violates constitution: AWS is primary cloud, CDK is mandatory IaC
- Single Next.js app with Route Handlers — violates kit pattern: tRPC on Lambda is the standard backend

## Package Manager

**Decision**: pnpm with workspace protocol

**Rationale**: `build-frontend-backends` mandates pnpm with `workspace:*` protocol for internal dependencies. Turborepo orchestrates tasks via `turbo.json`.

## Map Library

**Decision**: MapLibre GL JS

**Rationale**: Open-source fork of Mapbox GL JS with no API key requirement. Supports clustering, GeoJSON overlays, polygon drawing, and smooth performance with large datasets. React bindings via `react-map-gl` with MapLibre adapter.

**Alternatives considered**:
- Mapbox GL JS — requires API key and usage-based pricing
- Leaflet — weaker performance with 200k+ markers, no native vector tiles
- Google Maps — requires API key, usage fees, less customizable

## Property Data Querying

**Decision**: DuckDB for both client-side (WASM in browser) and server-side (Node bindings in Lambda) querying of Parquet from IPFS

**Rationale**: The pipeline publishes a query-table Parquet file at the `oracle-query-table-duval` IPNS label. DuckDB reads this via HTTP range requests (httpfs), enabling SQL queries on ~245k properties without any hosted database. Client-side DuckDB-WASM powers the map and search UI. Server-side DuckDB Node powers webhook matching and RAG agent queries in Lambda. This satisfies FR-016 (no Oracle hosted-DB cost).

**Alternatives considered**:
- Client-only DuckDB-WASM — insufficient: webhook handler and agent run server-side in Lambda
- Neon Postgres for property data — violates FR-016 (would shift DB cost to Oracle pipeline)
- SQLite WASM — lacks Parquet httpfs support

## CRM State Persistence

**Decision**: Vercel Neon Postgres via Drizzle ORM

**Rationale**: Constitution specifies "Vercel Neon for hosted query DB." The CRM needs to persist its own state (saved criteria, opportunities, notifications, outreach records) across sessions. This is CRM's own cost, not Oracle's. Drizzle ORM provides type-safe schema aligned with TypeScript-first approach. tRPC procedures in Lambda access Neon via serverless driver.

**Alternatives considered**:
- DynamoDB — works on AWS but awkward for relational CRM data (stages, history, joins)
- RDS Postgres — heavier infrastructure; Neon serverless is lighter for single-user workload

## Map Performance at Scale

**Decision**: MapLibre cluster layer with progressive loading

**Rationale**: 245k markers rendered individually would overwhelm the browser. MapLibre's built-in `cluster` source groups nearby properties at low zoom. Properties loaded as GeoJSON from client-side DuckDB-WASM. For filtered views, result sets are hundreds to low thousands — within direct rendering limits.

## Backend API Layer

**Decision**: tRPC with AWS Lambda adapter

**Rationale**: `build-frontend-backends` mandates tRPC for the API layer. Routers organized by domain (properties, criteria, opportunities, notifications, outreach, agent). Zod validation on all inputs. `AppRouter` type exported to `packages/api-client/` for type-safe frontend consumption. Lambda adapter via `@trpc/server/adapters/aws-lambda`.

## RAG Agent Architecture

**Decision**: Vercel AI SDK with DuckDB Node as a tool, running in Lambda

**Rationale**: Constitution mandates Vercel AI SDK for all LLM interactions. The agent receives natural-language queries via a tRPC procedure, translates them to SQL using a system prompt with the Parquet schema, executes via server-side DuckDB Node, and returns results with provenance. Tool schemas defined with Zod (mandatory per `stack-ai-sdk-for-llm` rule). Uses `generateText` with tool calling, not hand-rolled loops.

## Webhook Processing

**Decision**: tRPC procedure (or dedicated Lambda) with HMAC verification and sequential processing

**Rationale**: The pipeline sends webhook events (at-least-once) after publishing. The handler: (1) verifies HMAC-SHA256 signature, (2) deduplicates by event_id in Neon, (3) loads delta parcel IDs from the new Parquet via server-side DuckDB, (4) runs saved criteria against delta records, (5) generates summary notifications. Powertools Logger + Tracer + Metrics instrument the entire flow.

## Observability

**Decision**: AWS Lambda Powertools (Logger, Tracer, Metrics) + PagerDuty alerting

**Rationale**: Constitution mandates Powertools on every Lambda, X-Ray active tracing, and PagerDuty for critical failures. Metrics include `WebhookProcessed`, `WebhookFailed`, `NotificationGenerated`, `CriteriaMatched`, `ProcessingDuration` — all registered in Lexicon with CloudWatch dashboard widgets.

**Critical failure alerting**: PagerDuty trigger on terminal webhook processing failure (exhausted retries, unrecoverable error). Routing key from Secrets Manager; gated to production account.

## Infrastructure

**Decision**: CDK stack with Lambda + API Gateway v2 + custom domain

**Rationale**: Constitution mandates CDK as the only IaC tool. Stack deploys tRPC Lambda behind HTTP API Gateway v2 in us-east-2. X-Ray tracing enabled. Resources tagged with `project_name`. Custom domain mapping with base path.

## Frontend Hosting

**Decision**: AWS Amplify

**Rationale**: `build-frontend-backends` mandates Amplify for frontend apps. Next.js app deploys to Amplify with `amplify.yml` config. Environment variables per branch (`NEXT_PUBLIC_API_URL` pointing to API Gateway custom domain). Amplify handles builds via Turborepo pipeline (`pnpm turbo run build --filter=web...`).

## CI/CD

**Decision**: GitHub Actions with Vitest + CDK deploy

**Rationale**: Constitution mandates Vitest for TypeScript testing and GitHub Actions for CI. Pipeline runs lint, typecheck, test, build. CDK deploy triggered on merge to main.
