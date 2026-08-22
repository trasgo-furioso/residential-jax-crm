# Implementation Plan: Residential Property Acquisition CRM

**Branch**: `feature/003-residential-jax-crm` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-residential-jax-crm/spec.md`

## Summary

Build a map-based CRM for residential property acquisition in Jacksonville/Duval County. Turborepo monorepo with Next.js frontend on AWS Amplify, tRPC backend on Lambda (CDK), DuckDB for Parquet queries from Elephant IPFS (client-side WASM + server-side Node), Neon Postgres for CRM state, Vercel AI SDK for RAG agent. Webhook receiver processes pipeline events. Powertools observability on every Lambda.

## Technical Context

**Language/Version**: TypeScript 5.x (constitution: TypeScript for all services)

**Primary Dependencies**: Next.js 14+ (App Router), MapLibre GL JS, DuckDB-WASM (client) + DuckDB Node (server/Lambda), tRPC with Lambda adapter, Drizzle ORM + @neondatabase/serverless, Vercel AI SDK (`ai` + `@ai-sdk/amazon-bedrock`), AWS Lambda Powertools (Logger, Tracer, Metrics)

**Package Manager**: pnpm with workspace protocol (`workspace:*`)

**Task Orchestration**: Turborepo (`turbo.json`)

**Storage**: DuckDB (client-WASM + server-Node) reads Parquet from IPFS httpfs — zero hosted DB cost to Oracle. Neon Postgres for CRM-owned state (opportunities, saved criteria, notifications, outreach records — CRM's own cost, not Oracle's).

**Testing**: Vitest (constitution: Vitest for TypeScript), aws-sdk-client-mock for AWS mocking

**Target Platform**: AWS — Next.js on Amplify (frontend), Lambda + API Gateway v2 via CDK (backend). Region: us-east-2.

**Project Type**: Fullstack Turborepo monorepo

**Performance Goals**: Map interactions < 2s at full Duval County scale (~245k properties), search-to-results < 60s, notification generation < 5 min after webhook, agent queries < 10s

**Constraints**: No Oracle-hosted DB cost. Data access via IPNS pointers to IPFS. Single-user, no auth. Webhook receiver must be idempotent (at-least-once delivery). CDK is only IaC. Powertools on every Lambda. PagerDuty for critical failures.

**Scale/Scope**: ~245,000 residential properties, single county (Duval), single user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| TypeScript for all services | PASS | TypeScript throughout (no exceptions) |
| Vercel AI SDK for LLM | PASS | RAG agent uses `ai` + `@ai-sdk/amazon-bedrock` with Zod tool schemas |
| AWS primary cloud, us-east-2 | PASS | Amplify (frontend) + Lambda/API Gateway (backend) in us-east-2 |
| CDK is only IaC | PASS | CDK stack for Lambda + API Gateway v2 + custom domain |
| Powertools on every Lambda | PASS | Logger + Tracer + Metrics initialized in tRPC context |
| PagerDuty for critical failures | PASS | Webhook processing terminal failures trigger PagerDuty |
| Metrics registered in Lexicon | PASS | WebhookProcessed, NotificationGenerated, CriteriaMatched, ProcessingDuration |
| Deployed to hosted runtime | PASS | Amplify + Lambda — no local setup |
| Real data at scale | PASS | Full Duval County dataset (~245k properties) from IPFS |
| Provenance on all records | PASS | Every property carries `provenance` from pipeline |
| No Oracle hosted-DB cost | PASS | Property data from IPFS via DuckDB; CRM state in CRM-owned Neon |
| PR to designated repo | PASS | Will PR to `prismteam-ai/residential-jax-crm` |
| Demo artifact | PASS | Video walkthrough planned |
| Testing: Vitest + GitHub Actions | PASS | Vitest unit/integration/contract tests, GitHub Actions CI |

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
apps/
├── web/                                  # Next.js frontend → AWS Amplify
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                # Root layout with sidebar nav
│   │   │   ├── page.tsx                  # Map + list dashboard (US1)
│   │   │   ├── opportunities/
│   │   │   │   └── page.tsx              # Opportunity list + filters (US4)
│   │   │   └── notifications/
│   │   │       └── page.tsx              # Notification history (US3)
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── PropertyMap.tsx       # MapLibre map with clustering
│   │   │   │   ├── PropertyMarker.tsx    # Marker + popup
│   │   │   │   └── DrawControl.tsx       # Polygon/radius drawing
│   │   │   ├── properties/
│   │   │   │   ├── PropertyList.tsx      # Sortable list view
│   │   │   │   ├── PropertyDetail.tsx    # Detail panel with provenance
│   │   │   │   └── SearchCriteria.tsx    # Criteria builder form
│   │   │   ├── opportunities/
│   │   │   │   ├── OpportunityCard.tsx   # Stage, notes, offers
│   │   │   │   ├── StageTracker.tsx      # Stage progression
│   │   │   │   └── OutreachPanel.tsx     # Mocked outreach UI
│   │   │   ├── notifications/
│   │   │   │   ├── NotificationBell.tsx  # Header notification icon
│   │   │   │   └── NotificationList.tsx  # History list
│   │   │   └── agent/
│   │   │       └── AgentChat.tsx         # NL query interface
│   │   └── lib/
│   │       └── duckdb.ts                 # Client-side DuckDB-WASM init + queries
│   ├── amplify.yml                       # Amplify build config
│   └── package.json
├── api/                                  # tRPC backend → Lambda + CDK
│   ├── src/
│   │   ├── handler.ts                    # Lambda entry point (awsLambdaRequestHandler)
│   │   ├── context.ts                    # tRPC context with Powertools Logger/Tracer/Metrics
│   │   ├── routers/
│   │   │   ├── index.ts                  # Root router merging all domain routers
│   │   │   ├── properties.ts             # Property queries via server-side DuckDB
│   │   │   ├── criteria.ts               # Saved criteria CRUD
│   │   │   ├── opportunities.ts          # Opportunity CRUD + stage management
│   │   │   ├── notifications.ts          # Notification list + mark read
│   │   │   ├── outreach.ts               # Mocked outreach CRUD + lifecycle sim
│   │   │   ├── webhook.ts                # Pipeline webhook receiver
│   │   │   ├── agent.ts                  # RAG agent (Vercel AI SDK)
│   │   │   └── export.ts                 # CSV export
│   │   ├── services/
│   │   │   ├── criteria-matcher.ts       # Match scoring logic (percentage + breakdown)
│   │   │   ├── webhook-handler.ts        # HMAC verify, dedup, delta matching, notification gen
│   │   │   ├── duckdb.ts                 # Server-side DuckDB Node init + Parquet queries
│   │   │   └── ipfs.ts                   # IPNS resolution + artifact URL construction
│   │   └── lib/
│   │       └── db/
│   │           ├── schema.ts             # Drizzle schema (CRM state)
│   │           └── index.ts              # Drizzle client (Neon serverless)
│   ├── infra/
│   │   └── stack.ts                      # CDK stack (Lambda, API Gateway v2, custom domain)
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── criteria-matcher.test.ts
│   │   │   └── webhook-handler.test.ts
│   │   ├── integration/
│   │   │   └── webhook-flow.test.ts
│   │   └── contract/
│   │       └── webhook-payload.test.ts
│   └── package.json
packages/
├── api-client/                           # Shared tRPC client + AppRouter type
│   ├── src/
│   │   └── index.ts                      # tRPC client, AppRouter export, React hooks
│   └── package.json
├── shared/                               # Shared types, validation, constants
│   ├── src/
│   │   ├── types/
│   │   │   ├── property.ts               # Property, Owner, Provenance, DerivedSignals
│   │   │   ├── crm.ts                    # Opportunity, Outreach, Task, SavedCriteria
│   │   │   └── pipeline.ts               # WebhookEvent, PipelineRun, DeltaSummary
│   │   └── index.ts                      # Re-exports
│   └── package.json
└── tsconfig/                             # Shared TypeScript configs
    ├── base.json
    ├── nextjs.json
    └── node.json

turbo.json                                # Turborepo pipeline config
pnpm-workspace.yaml                       # Workspace definition
package.json                              # Root workspace scripts
```

**Structure Decision**: Turborepo monorepo following `metagross` / `build-frontend-backends` pattern exactly. `apps/web/` is the Next.js frontend on Amplify. `apps/api/` is the tRPC backend on Lambda via CDK. `packages/api-client/` exports the shared tRPC client and `AppRouter` type. `packages/shared/` holds types used by both apps. Property data queried via DuckDB (WASM client-side, Node server-side) from IPFS Parquet. CRM state in Neon Postgres via Drizzle.

## Agent & Skill Mapping

Routing decision from `arceus`. Each implementation challenge maps to a specific agent and skills from the soofi-xyz team kit.

### Phase 1: Project Scaffolding

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Turborepo monorepo, pnpm workspace, turbo.json, shared TS configs | `metagross` | `build-frontend-backends`, `apply-engineering-guidelines` | Metagross owns Turborepo monorepo design with pnpm workspace protocol |

### Phase 2: Data Layer — Property Data from IPFS

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Explore Duval property schema, verify Parquet field availability | `donphan` | `use-elephant-mcp` | Donphan explores Oracle open-data via MCP tools |
| DuckDB-WASM (client) + DuckDB Node (server) integration, Parquet httpfs, IPNS resolution | `metagross` | `use-elephant-query-db`, `build-frontend-backends` | Metagross handles TypeScript implementation; use-elephant-query-db covers query patterns |

### Phase 3: CRM State Layer — Neon Postgres

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Drizzle schema, migrations, tRPC CRUD routers | `metagross` | `use-elephant-query-db`, `apply-engineering-guidelines` | Metagross builds the tRPC router layer; engineering guidelines enforce testing |

### Phase 4: Frontend — Map & Search UI

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| MapLibre GL, clustered markers, detail panel, list view, polygon drawing | `metagross` | `build-frontend-backends` | Metagross handles Next.js frontend on Amplify |
| Criteria builder, match-score display, saved searches, CRM workflow UI | `metagross` | `build-frontend-backends` | Frontend components consuming tRPC via packages/api-client |

### Phase 5: Webhook Handler & Notifications

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Webhook tRPC router (HMAC, idempotency, sequential processing), criteria matching, notification generation | `metagross` | `apply-engineering-guidelines`, `build-frontend-backends` | tRPC router in Lambda with Powertools observability |

### Phase 6: RAG Agent — Natural-Language Queries

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Vercel AI SDK agent tRPC router, DuckDB Node tool, Zod tool schemas | `ash` | `build-ai-agents` | Ash designs serverless agents with Vercel AI SDK; build-ai-agents covers ToolLoopAgent |

### Phase 7: CDK Infrastructure

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| CDK stack: Lambda, API Gateway v2, custom domain, X-Ray, Powertools env vars | `metagross` | `build-frontend-backends`, `apply-engineering-guidelines` | CDK infrastructure per build-frontend-backends cdk-api-infrastructure rule |

### Phase 8: Observability & Alerting

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Powertools Logger/Tracer/Metrics in tRPC context, PagerDuty for critical webhook failures, Lexicon metric registration | `metagross` | `apply-engineering-guidelines` | Engineering guidelines mandate Powertools + PagerDuty + Lexicon registration |

### Phase 9: Testing & CI/CD

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Vitest unit/integration/contract tests, GitHub Actions pipeline | `metagross` | `apply-engineering-guidelines`, `integrate-ci-cd` | Engineering guidelines mandate Vitest + GitHub Actions CI |

### Phase 10: Deployment & Demo

| Challenge | Agent | Skills | Rationale |
|-----------|-------|--------|-----------|
| Amplify frontend deployment, CDK backend deployment, hosted runtime verification | `metagross` | `build-frontend-backends`, `apply-engineering-guidelines` | Amplify config per amplify-frontend rule; CDK deploy per cdk-api-infrastructure rule |
| Demo video walkthrough | — | — | Manual effort |

### Agent Summary

| Agent | Role in This Project |
|-------|---------------------|
| `metagross` | **Primary** — monorepo scaffolding, tRPC backend, frontend, CDK infra, observability, deployment |
| `donphan` | **Discovery** — explore Duval property data via MCP before building queries |
| `ash` | **RAG agent** — serverless AI agent design with Vercel AI SDK |
| `oracle` | **Deferred** — court-data ingestion if foreclosure/lien enrichment is added later |

### Skill Load Order

1. `apply-engineering-guidelines` — baseline for every phase (AWS, CDK, Powertools, Vitest, PagerDuty)
2. `build-frontend-backends` — Turborepo, tRPC, Amplify, CDK, shared packages
3. `use-elephant-mcp` — property data exploration and schema
4. `use-elephant-query-db` — Drizzle/Neon query patterns
5. `build-ai-agents` — Vercel AI SDK agent with Zod tools
6. `integrate-ci-cd` — GitHub Actions pipelines

## Complexity Tracking

No constitution violations. No complexity justifications needed.
