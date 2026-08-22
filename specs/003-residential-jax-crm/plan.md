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

## Complexity Tracking

No constitution violations. No complexity justifications needed.
