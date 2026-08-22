# Implementation Plan: Residential Property Acquisition CRM

**Branch**: `feature/003-residential-jax-crm` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-residential-jax-crm/spec.md`

## Summary

Build a map-based CRM for residential property acquisition in Jacksonville/Duval County. The CRM consumes pipeline-published property data from Elephant IPFS (Parquet via DuckDB-WASM), receives webhook events when the pipeline publishes new artifacts, matches saved criteria against delta records, and provides a unified workflow from property discovery through deal tracking. Deployed as a Next.js fullstack app on Vercel.

## Technical Context

**Language/Version**: TypeScript 5.x (constitution: TypeScript for all services)

**Primary Dependencies**: Next.js 14+ (App Router), MapLibre GL JS (open-source map), DuckDB-WASM (client-side Parquet queries from IPFS), Vercel AI SDK (RAG agent), Drizzle ORM (CRM state persistence)

**Storage**: DuckDB-WASM for property data (reads Parquet from IPFS httpfs — zero hosted DB cost to Oracle). Vercel Neon Postgres for CRM-owned state (opportunities, saved criteria, notifications, outreach records — CRM's own cost, not Oracle's).

**Testing**: Vitest (constitution: Vitest for TypeScript)

**Target Platform**: Web application deployed to Vercel (hosted runtime, no local setup — constitution: Deployment-First)

**Project Type**: Fullstack web application (Next.js)

**Performance Goals**: Map interactions < 2s at full Duval County scale (~245k properties), search-to-results < 60s, notification generation < 5 min after webhook, agent queries < 10s

**Constraints**: No Oracle-hosted DB cost. Data access via IPNS pointers to IPFS. Single-user, no auth. Webhook receiver must be idempotent (at-least-once delivery from pipeline).

**Scale/Scope**: ~245,000 residential properties, single county (Duval), single user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| TypeScript for all services | PASS | Next.js + TypeScript throughout |
| Vercel AI SDK for LLM | PASS | RAG agent uses Vercel AI SDK |
| Deployed to hosted runtime | PASS | Vercel deployment, no local setup |
| Real data at scale | PASS | Full Duval County dataset (~245k properties) from IPFS |
| Provenance on all records | PASS | Every property carries `provenance` from pipeline |
| No Oracle hosted-DB cost | PASS | Property data from IPFS via DuckDB-WASM; CRM state in CRM-owned Neon |
| PR to designated repo | PASS | Will PR to `prismteam-ai/residential-jax-crm` |
| Demo artifact | PASS | Video walkthrough planned |

All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-residential-jax-crm/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── webhook-receiver.md
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                # Root layout with sidebar nav
│   ├── page.tsx                  # Map + list dashboard (US1)
│   ├── api/
│   │   ├── webhook/
│   │   │   └── pipeline/route.ts # Webhook receiver (US3, FR-007)
│   │   ├── agent/route.ts        # RAG agent endpoint (US6)
│   │   └── export/route.ts       # CSV export (US7)
│   ├── opportunities/
│   │   └── page.tsx              # Opportunity list + filters (US4)
│   └── notifications/
│       └── page.tsx              # Notification history (US3)
├── components/
│   ├── map/
│   │   ├── PropertyMap.tsx       # MapLibre map with clustering
│   │   ├── PropertyMarker.tsx    # Marker + popup
│   │   └── DrawControl.tsx       # Polygon/radius drawing
│   ├── properties/
│   │   ├── PropertyList.tsx      # Sortable list view
│   │   ├── PropertyDetail.tsx    # Detail panel with provenance
│   │   └── SearchCriteria.tsx    # Criteria builder form
│   ├── opportunities/
│   │   ├── OpportunityCard.tsx   # Stage, notes, offers
│   │   ├── StageTracker.tsx      # Stage progression
│   │   └── OutreachPanel.tsx     # Mocked outreach UI
│   ├── notifications/
│   │   ├── NotificationBell.tsx  # Header notification icon
│   │   └── NotificationList.tsx  # History list
│   └── agent/
│       └── AgentChat.tsx         # NL query interface
├── lib/
│   ├── duckdb.ts                 # DuckDB-WASM init + query helpers
│   ├── ipfs.ts                   # IPNS resolution + artifact fetching
│   ├── criteria-matcher.ts       # Match scoring logic (percentage + breakdown)
│   ├── webhook-handler.ts        # Webhook processing + notification generation
│   └── db/
│       ├── schema.ts             # Drizzle schema (CRM state)
│       └── index.ts              # Drizzle client
└── types/
    ├── property.ts               # Property, Owner, Provenance types
    ├── crm.ts                    # Opportunity, Outreach, Task types
    └── pipeline.ts               # WebhookEvent, PipelineRun types

tests/
├── unit/
│   ├── criteria-matcher.test.ts
│   ├── webhook-handler.test.ts
│   └── duckdb.test.ts
├── integration/
│   └── webhook-flow.test.ts
└── contract/
    └── webhook-payload.test.ts
```

**Structure Decision**: Fullstack Next.js App Router with colocated API routes. Property data is queried client-side from IPFS via DuckDB-WASM. CRM state (opportunities, criteria, notifications) lives in Vercel Neon Postgres via Drizzle ORM. This separates the zero-cost property data layer from the CRM's own lightweight state.

## Agent & Skill Mapping

Routing decision from `arceus`. Each implementation challenge maps to a specific agent (persona/orchestrator) and one or more skills (knowledge/playbook) from the soofi-xyz team kit.

### Phase 1: Project Scaffolding

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Monorepo structure, Next.js App Router layout, shared packages, tRPC API shape | `metagross` | `build-frontend-backends`, `apply-engineering-guidelines` | Metagross owns fullstack monorepo design with Turborepo, Amplify frontends, tRPC + Lambda backends, and CDK infrastructure |

### Phase 2: Data Layer — Property Data from IPFS

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Explore Duval property schema, verify field availability, test queries | `donphan` | `use-elephant-mcp` | Donphan explores Oracle open-data via MCP tools; use-elephant-mcp documents query patterns and schema |
| DuckDB-WASM integration, Parquet httpfs loading, IPNS resolution | `metagross` | `use-elephant-query-db`, `build-frontend-backends` | Metagross handles the TypeScript implementation; use-elephant-query-db covers Drizzle/DuckDB query patterns |

### Phase 3: CRM State Layer — Neon Postgres

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Drizzle schema (opportunities, saved criteria, notifications, outreach, tasks), migrations, CRUD API routes | `metagross` | `use-elephant-query-db`, `apply-engineering-guidelines` | Metagross builds the tRPC/API layer; use-elephant-query-db has Drizzle + Neon patterns; engineering guidelines enforce TypeScript + testing standards |

### Phase 4: Frontend — Map & Search UI

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| MapLibre GL integration, clustered markers, property detail panel, list view, polygon/radius drawing | `metagross` | `build-frontend-backends` | Metagross handles Next.js frontend components; build-frontend-backends covers Amplify + monorepo UI patterns |
| Criteria builder form, match-score display, saved searches UI | `metagross` | `build-frontend-backends` | Search UI is a frontend concern within the monorepo |
| Opportunity management, stage tracker, outreach panel, task list | `metagross` | `build-frontend-backends` | CRM workflow UI components |

### Phase 5: Webhook Handler & Notifications

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Webhook receiver (HMAC verification, idempotency, sequential processing), criteria matching against delta records, summary notification generation | `metagross` | `apply-engineering-guidelines`, `build-frontend-backends` | Next.js API route handler; metagross owns the backend; engineering guidelines enforce observability and testing |

### Phase 6: RAG Agent — Natural-Language Queries

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Local RAG POC — prove DuckDB property queries work from natural language | — | `build-local-rag-pocs` | Start with a local TypeScript CLI POC before integrating into the app |
| Vercel AI SDK agent integration, system prompt with Parquet schema, tool calling for DuckDB queries | `ash` | `build-ai-agents` | Ash designs Lambda/serverless agents with Vercel AI SDK + Bedrock; build-ai-agents covers ToolLoopAgent patterns |
| Production RAG with OpenSearch (if local POC insufficient) | `alakazam` / `espeon` | `build-rag-systems` | Alakazam/Espeon own AWS RAG migration; build-rag-systems covers OpenSearch, embeddings, webhook ingestion |

### Phase 7: Export & Placeholders

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| CSV export of properties/opportunities, placeholder sections for future features | `metagross` | `build-frontend-backends` | Straightforward fullstack feature within the monorepo |

### Phase 8: Testing & CI/CD

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Vitest unit/integration tests, contract tests for webhook payload | `metagross` | `apply-engineering-guidelines` | Engineering guidelines mandate Vitest + testing strategy |
| GitHub Actions CI/CD pipeline, justfile recipes | — | `integrate-ci-cd` | integrate-ci-cd covers shared workflow integration |

### Phase 9: Deployment & Demo

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Vercel deployment, environment config, hosted runtime verification | `metagross` | `apply-engineering-guidelines` | Metagross handles deployment; engineering guidelines enforce observability |
| Demo video walkthrough | — | — | Manual effort, not agent-assisted |

### Agent Summary

| Agent | Role in This Project |
|-------|---------------------|
| `metagross` | **Primary** — scaffolding, frontend, backend, webhook, data layer, testing, deployment |
| `donphan` | **Discovery** — explore Duval property data via MCP before building queries |
| `ash` | **RAG agent** — serverless AI agent design with Vercel AI SDK |
| `alakazam` / `espeon` | **Contingency** — production RAG migration if local POC is insufficient |
| `oracle` | **Deferred** — court-data ingestion if foreclosure/lien enrichment is added later |

### Skill Load Order

1. `apply-engineering-guidelines` — baseline for every phase
2. `build-frontend-backends` — monorepo, tRPC, Amplify, CDK
3. `use-elephant-mcp` — property data exploration and schema
4. `use-elephant-query-db` — Drizzle/Neon query patterns
5. `build-local-rag-pocs` — RAG POC before production
6. `build-ai-agents` — Vercel AI SDK agent patterns
7. `build-rag-systems` — AWS RAG migration (if needed)
8. `integrate-ci-cd` — GitHub Actions pipelines

## Complexity Tracking

No constitution violations. No complexity justifications needed.
