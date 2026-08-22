# Implementation Plan: Oracle Pipeline — Duval County

**Branch**: `feature/001-oracle-crm-integration` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-oracle-pipeline-duval/spec.md` (R1 of parent roadmap)

## Summary

Build a continuous/incremental property data pipeline for Duval County, FL that ingests real county records, reconciles duplicates, publishes full-snapshot artifacts with delta metadata to Elephant IPFS, sends webhook events to consumers, and provides a UI for pipeline monitoring and property intelligence queries — all deployed to a hosted runtime with zero Oracle infrastructure cost.

## Technical Context

**Language/Version**: TypeScript (Node 22.18+); Python only if PySpark/Glue needed

**Primary Dependencies**:
- Elephant CLI (`elephant-cli`) for prepare, transform, validate
- Elephant MCP (`@elephant-xyz/mcp`) for MCP query layer
- Restate 1.7 for durable workflow orchestration
- DuckDB (in-process) for analytical queries over published Parquet
- `@aws-sdk/client-s3` for Filebase IPFS uploads
- `ipfs-only-hash` for local CID pre-computation
- Vercel AI SDK (`ai` package) for natural-language agent
- AWS CDK for infrastructure

**Storage**:
- Postgres 16 (pipeline query DB, Docker on EC2)
- DuckDB (analytical queries over Parquet, in-process)
- Filebase (S3-compatible IPFS pinning + IPNS management)
- Per-county buckets: `elephant-oracle-open-data-duval`, `elephant-oracle-query-table-duval`

**Testing**: Vitest (TypeScript), GitHub Actions CI

**Target Platform**: EC2 (t3.large, us-east-2) for pipeline backend + Amplify for frontend + Lambda for agent/MCP

**Project Type**: Web application (pipeline backend + operator UI frontend)

**Performance Goals**: Agent queries < 10 seconds; webhook delivery < 30 seconds post-publish; IPNS update detection < 5 minutes

**Constraints**: Zero Oracle-hosted database cost; deployed hosted runtime mandatory (no localhost); realistic data scale (100k+ Duval properties)

**Scale/Scope**: ~200k-400k Duval County properties; 6+ data sources; continuous pipeline with multiple runs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Elephant Protocol Alignment | PASS | Pipeline follows oracle skills pattern: onboard-county → stage skills → ingest → publish. Lexicon transform, CIDv1+SHA-256, Filebase IPFS, IPNS per county. |
| II. Golden Path Engineering | PASS | TypeScript everywhere, Vercel AI SDK for agent, CDK for infra, Vitest, Powertools observability, PagerDuty alerting. |
| III. Deployment-First | PASS | Deployment is Phase 0 prerequisite. Hosted runtime on AWS (Amplify + EC2/ECS or Restate Cloud). No localhost delivery. |
| IV. Realistic Data Scale | PASS | Targeting full Duval County parcel roll (200k-400k properties). Toy datasets rejected. |

No violations. No complexity tracking entries needed.

## Deployment Architecture

**Approach**: EC2 + Docker Compose (mirrors oracle-node pattern) + Amplify + Lambda

### Infrastructure Components

```
┌─────────────────────────────────────────────────────┐
│  EC2 (t3.large, us-east-2)                          │
│                                                     │
│  Docker Compose                                     │
│  ├── Restate 1.7        (ports 8080, 9070)          │
│  ├── Postgres 16        (port 5432, EBS volume)     │
│  └── Pipeline services  (port 9080, Node 22.18+)    │
│                                                     │
│  Caddy reverse proxy (auto-TLS)                     │
│      ├── /api/*    → Pipeline services :9080        │
│      ├── /mcp      → MCP endpoint :9090             │
│      └── /restate  → Restate admin :9070            │
│                                                     │
│  Security group: 443 (HTTPS), 22 (SSH)              │
│  EBS volume: 100GB gp3 (pipeline data + Postgres)   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Amplify (CDK-deployed)                             │
│  └── React frontend (static site)                   │
│      ├── Dashboard, run history, data explorer      │
│      ├── Property query UI                          │
│      └── Agent chat interface                       │
│      API calls → EC2 HTTPS /api/*                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Lambda + API Gateway (CDK-deployed)                │
│  ├── Agent function (Vercel AI SDK + DuckDB)        │
│  │   └── Queries published Parquet via httpfs        │
│  └── MCP function (stateless, reads IPNS)           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Filebase (external, S3-compatible)                 │
│  ├── elephant-oracle-open-data-duval    (IPFS)      │
│  ├── elephant-oracle-query-table-duval  (IPFS)      │
│  └── IPNS pointers (stable, per-county)             │
└─────────────────────────────────────────────────────┘
```

### CDK Stacks

```
infra/lib/
├── pipeline-stack.ts     # EC2 instance, security group, EBS volume,
│                         # IAM role, user-data script (docker compose up)
├── frontend-stack.ts     # Amplify app, branch auto-deploy, custom domain
└── agent-stack.ts        # Lambda functions, API Gateway, IAM for DuckDB httpfs
```

### Deployment Flow

1. **`npx cdk deploy PipelineStack`** — provisions EC2 with Docker Compose user-data. On first boot: pulls images, starts Restate + Postgres + pipeline services, configures Nginx + HTTPS.
2. **`npx cdk deploy FrontendStack`** — creates Amplify app connected to repo. Auto-builds and deploys React frontend on push.
3. **`npx cdk deploy AgentStack`** — deploys Lambda functions behind API Gateway for agent and MCP endpoints.

### Why EC2 + Docker Compose

- **Fidelity**: Identical to the oracle-node pattern from elephant-xyz/skills (Docker Compose with Restate + Postgres)
- **Speed**: One CDK stack, one instance, everything running in minutes
- **Cost**: ~$25-50/mo for t3.large — our cost, not Oracle's
- **Simplicity**: No ECS/Fargate complexity for Restate persistent state
- **Deployment-first**: Infrastructure is the FIRST task, unblocking all other work

### Persistence

- **Postgres data**: EBS volume mounted at `/data/postgres`, survives instance restarts
- **Restate state**: EBS volume mounted at `/data/restate`, durable workflow journals persist
- **Pipeline artifacts**: Local staging on EBS at `/data/pipeline`, published to Filebase IPFS

## UX Architecture

**Stack**: Vite + React + Shadcn/ui + Tailwind CSS + TanStack Table + Vercel AI SDK `useChat`

### Technology Choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | Vite + React | Amplify-compatible static SPA, TypeScript-first, fast dev server |
| Components | Shadcn/ui | Copy-paste components (no runtime dependency), Tailwind-native, accessible, professional |
| Styling | Tailwind CSS | Golden Path compatible, pairs with Shadcn, rapid iteration |
| Data tables | TanStack Table | Headless, Shadcn-compatible, handles 100k+ rows with virtualization |
| Agent chat | Vercel AI SDK `useChat` | Golden Path mandated for LLM UIs, handles streaming and tool calls |

Note: Leaflet + OpenStreetMap map view is deferred to R2 (CRM). The pipeline demo does not require a map.

### Shell Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ORACLE PIPELINE — DUVAL COUNTY                      [IPNS: ● Live]   │
│                                                      Last run: 2m ago  │
├──────────────┬──────────────────────────────────────────────────────────┤
│              │                                                         │
│  ┌────────┐  │                                                         │
│  │ ◉ Dash │  │  [Content area — selected page renders here]            │
│  │   board│  │                                                         │
│  └────────┘  │                                                         │
│  ┌────────┐  │                                                         │
│  │  Pipe- │  │                                                         │
│  │  line  │  │                                                         │
│  │  Runs  │  │                                                         │
│  └────────┘  │                                                         │
│  ┌────────┐  │                                                         │
│  │  Prop- │  │                                                         │
│  │  erty  │  │                                                         │
│  │  Search│  │                                                         │
│  └────────┘  │                                                         │
│  ┌────────┐  │                                                         │
│  │  Agent │  │                                                         │
│  │  Chat  │  │                                                         │
│  └────────┘  │                                                         │
│              │                                                         │
│  ──────────  │                                                         │
│  Duval, FL   │                                                         │
│  245,012 rec │                                                         │
│  6 sources   │                                                         │
│              │                                                         │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Sidebar: fixed 200px width, collapsible to icons. Bottom section shows county summary stats.
Top bar: app title left, IPNS health indicator + last run time right.

### Page 1: Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│  │ Total Props  │ │ Last Run     │ │ IPNS Status  │ │ Sources│ │
│  │              │ │              │ │              │ │        │ │
│  │   245,012    │ │ 2m ago       │ │   ● Live     │ │  6/6   │ │
│  │   +142 new   │ │ +142 / ~38   │ │ CID: bafy... │ │ healthy│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘ │
│                                                                 │
│  ┌── Records by Source ────────────────────────────────────────┐│
│  │  Source       │ Records  │ Last Collected   │ Status        ││
│  │  ─────────────┼──────────┼──────────────────┼────────────── ││
│  │  Appraiser    │ 85,210   │ Aug 20, 10:00    │ ● Healthy    ││
│  │  Permits      │ 62,400   │ Aug 20, 10:05    │ ● Healthy    ││
│  │  Ownership    │ 48,100   │ Aug 19, 22:00    │ ● Healthy    ││
│  │  Business     │ 28,300   │ Aug 20, 10:02    │ ● Healthy    ││
│  │  Contractor   │ 15,200   │ Aug 20, 10:10    │ ⚠ Slow       ││
│  │  Geo/Coords   │ 47,800   │ Aug 20, 10:00    │ ● Healthy    ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌── Elephant IPFS & MCP ──────────────────────────────────────┐│
│  │  Open Data IPNS:   k51qzi...8f  ● Live   [Gateway ↗]      ││
│  │  Query Table IPNS: k51qzi...3a  ● Live   [Gateway ↗]      ││
│  │  MCP Endpoint:     https://<host>/mcp     ● Connected      ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Page 2: Pipeline Runs

```
┌─────────────────────────────────────────────────────────────────┐
│  Pipeline Runs                                  [Trigger Run ▶] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Run    │ Timestamp        │ New   │ Upd  │ Rem │ Status     ││
│  │ ───────┼──────────────────┼───────┼──────┼─────┼─────────── ││
│  │ ▶ #005 │ Aug 20, 14:30    │ 142   │ 38   │ 0   │ ● Success ││
│  │ ┌──────────────────────────────────────────────────────────┐ ││
│  │ │ Sources Ingested:                                       │ ││
│  │ │  ● Appraiser  12,340 rec  0.8s avg    ── no issues      │ ││
│  │ │  ● Permits     8,210 rec  1.2s avg    ── no issues      │ ││
│  │ │  ● Ownership   6,100 rec  0.5s avg    ── no issues      │ ││
│  │ │  ● Business    3,400 rec  0.9s avg    ── no issues      │ ││
│  │ │  ● Contractor  1,200 rec  3.1s avg    ⚠ slow source    │ ││
│  │ │  ● Geo/Coords  9,800 rec  0.3s avg    ── no issues      │ ││
│  │ │                                                         │ ││
│  │ │ Published Artifact:                                     │ ││
│  │ │  CID: bafybeig...7x2a    IPNS: k51qzi...d8f            │ ││
│  │ │  Webhook: ● Delivered to 1 consumer (204, 0.3s)         │ ││
│  │ │                                                         │ ││
│  │ │ Limitations:                                            │ ││
│  │ │  ⚠ Contractor source averaged 3.1s/request (rate limit)│ ││
│  │ └──────────────────────────────────────────────────────────┘ ││
│  │   #004 │ Aug 20, 10:15    │ 87    │ 12   │ 0   │ ● Success ││
│  │   #003 │ Aug 19, 22:00    │ 0     │ 5    │ 0   │ ● Success ││
│  │   #002 │ Aug 19, 14:30    │ 1204  │ 340  │ 2   │ ◐ Partial ││
│  │   #001 │ Aug 18, 09:00    │ 243k  │ 0    │ 0   │ ● Success ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Showing 5 of 5 runs                              [1] [2] [>]  │
└─────────────────────────────────────────────────────────────────┘
```

Expandable rows: click ▶ to expand run details (sources, artifact, webhook, limitations).

### Page 3: Property Search

```
┌─────────────────────────────────────────────────────────────────┐
│  Property Search                                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Query Selector ──────────────────────────────────────────┐│
│  │ [ Roofs older than 15 years                            ▼]  ││
│  │                                                            ││
│  │   Roofs older than 15 years                                ││
│  │   View of water                                            ││
│  │   No ownership change in 10+ years                         ││
│  │   Regional owners                                          ││
│  │   Walking distance to public transit                       ││
│  │   Walking distance to Starbucks                            ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  8,412 results                                  [Export CSV ↓]  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Parcel ID  │ Address          │ Value   │ Signal  │ Sources ││
│  │ ───────────┼──────────────────┼─────────┼─────────┼──────── ││
│  │ RE0001234  │ 123 Main St      │ $185k   │ 18 yrs  │ 3      ││
│  │ RE0005678  │ 456 Oak Ave      │ $220k   │ 22 yrs  │ 2      ││
│  │ RE0009012  │ 789 Pine Rd      │ $142k   │ 16 yrs  │ 4      ││
│  │ RE0003456  │ 321 Elm Blvd     │ $310k   │ 20 yrs  │ 3      ││
│  │ ...                                                         ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  "Signal" column adapts to selected query:                      │
│    Roof query     → roof age in years                           │
│    Water query    → distance to water in ft                     │
│    Ownership      → years since last transfer                   │
│    Regional       → owner location (e.g., "Miami, FL")          │
│    Transit        → distance to nearest stop in mi              │
│    Starbucks      → distance to nearest location in mi          │
│                                                                 │
│  ┌── Property Detail Drawer (click any row) ──────────────────┐ │
│  │                                                    [✕]     │ │
│  │  RE0001234 — 123 Main St, Jacksonville, FL 32202           │ │
│  │                                                            │ │
│  │  Assessed Value: $185,000    Year Built: 2008              │ │
│  │  Sqft: 1,800                 Owner: Smith, John            │ │
│  │  Roof Age: 18 years          Last Sale: 2012-03-15         │ │
│  │  Water: 1,200 ft             Transit: 0.3 mi               │ │
│  │  Starbucks: 0.8 mi           Regional: No (local)          │ │
│  │                                                            │ │
│  │  ── Source Provenance ──────────────────────────────────    │ │
│  │  ● duval-appraiser   collected Aug 20, 10:00   Run #005   │ │
│  │  ● duval-permits     collected Aug 20, 10:05   Run #005   │ │
│  │  ● duval-ownership   collected Aug 19, 22:00   Run #003   │ │
│  │  Reconciliation confidence: 0.98                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Clicking any row opens the property detail drawer with full attributes and source provenance.

### Page 4: Agent Chat

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Chat                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  ┌─ You ──────────────────────────────────────────────────┐ ││
│  │  │ Which properties have roofs older than 15 years and    │ ││
│  │  │ have not exchanged ownership in more than 10 years?    │ ││
│  │  └────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │  ┌─ Agent ────────────────────────────────────────────────┐ ││
│  │  │ I found 1,247 properties matching both criteria.       │ ││
│  │  │ Here are the top results:                              │ ││
│  │  │                                                        │ ││
│  │  │ ┌─ Result ──────────────────────────────────────────┐  │ ││
│  │  │ │ RE0001234 — 123 Main St                           │  │ ││
│  │  │ │ Roof: 18 yrs (permit 2008) │ Ownership: 12 yrs   │  │ ││
│  │  │ │ Source: duval-appraiser, duval-permits │ Run #005  │  │ ││
│  │  │ └──────────────────────────────────────────────────┘  │ ││
│  │  │ ┌─ Result ──────────────────────────────────────────┐  │ ││
│  │  │ │ RE0005678 — 456 Oak Ave                           │  │ ││
│  │  │ │ Roof: 22 yrs (permit 2004) │ Ownership: 15 yrs   │  │ ││
│  │  │ │ Source: duval-appraiser, duval-permits │ Run #005  │  │ ││
│  │  │ └──────────────────────────────────────────────────┘  │ ││
│  │  │                                                        │ ││
│  │  │ Query executed: SELECT * FROM properties               │ ││
│  │  │ WHERE roof_age_years > 15                              │ ││
│  │  │ AND ownership_tenure_years > 10                        │ ││
│  │  │                                                        │ ││
│  │  │ Data source: Published Parquet via DuckDB              │ ││
│  │  │ Last updated: Run #005 (Aug 20, 14:30)                 │ ││
│  │  └────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────────────────────────────────────── ┌──────┐ │
│  │ Ask about Duval County properties...                │ Send │ │
│  └──────────────────────────────────────────────────── └──────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Agent responses show: answer text, result cards with source provenance, the DuckDB query executed, and data freshness.

### Validation Strategy

**No custom Playwright e2e tests.** Use Slowking (from soofi-xyz-team-kit) as the e2e validation tool — the same agent that will perform the final evaluation.

**Self-assessment loop**:
```
Build → Deploy → Smoke test → Run Slowking → Fix gaps → Redeploy → Re-run
```

**Smoke test** (pre-Slowking, fast check that endpoints are up):
```
scripts/smoke-test.sh
├── curl deployed frontend URL → expect 200
├── curl /api/health → expect 200 with record count
├── curl /mcp (POST listOracleProperties) → expect JSON response
└── exit 0 if all pass, exit 1 if any fail
```

**Slowking self-assessment** (3-pillar evaluation against our deployed runtime):
1. `evaluate-candidate-intent` — validates we can articulate the business intent
2. `evaluate-candidate-product` — exercises deployed runtime with Playwright, scores functional outcome
3. `evaluate-candidate-implementation` — reviews code quality and kit usage

**Inputs to Slowking**:
- Assignment repo: `oracle-property-intelligence-platform-pipeline-duval-fl`
- Deployed runtime URL: `https://<ec2-domain>`
- Credentials: as configured
- Demo artifact: recorded video walkthrough
- PR: feature branch against assignment repo

**Why this approach**:
- Slowking IS the final evaluator — same scoring, no surprises
- No custom test code to maintain
- Using the kit's evaluation agent proves kit conformance (5 pts)
- Iterative — fix gaps Slowking identifies, redeploy, re-run until score is acceptable

### Demo Flow (maps to stakeholder transcript)

1. **Dashboard** → show overview, total records, records by source, source health, IPFS/MCP status
2. **Pipeline Runs** → show run history with deltas, expand a run to show source details, CID, webhook, limitations
3. **Property Search** → run all 6 query types one at a time, click a result to show provenance in detail drawer
4. **Agent Chat** → ask 3 agent prompts, show source-backed evidence with query transparency

## Project Structure

### Documentation (this feature)

```text
specs/002-oracle-pipeline-duval/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── webhook-event.md
│   └── published-artifact.md
├── research/            # Pre-plan research files
│   ├── elephant-protocol.md
│   ├── slowking-assessment.md
│   └── soofi-xyz-team-kit.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Repository & Commit Strategy

Two separate git repos with distinct commit responsibilities:

**Root repo** (`/Users/trasgofurioso/Code/elephant/`):
- Spec-driven workflow artifacts (specs/, .specify/)
- Slowking self-assessment results and smoke scripts
- Orchestrator commits here

**Delivery repo** (`oracle-property-intelligence-platform-pipeline-duval-fl/`):
- Git clone of the designated assignment repo
- ALL implementation code lives here
- Implementation agents MUST `cd oracle-property-intelligence-platform-pipeline-duval-fl` before working
- Implementation agents commit directly to this repo
- This is the repo submitted as PR for Slowking evaluation

### Source Code (delivery repo)

```text
oracle-property-intelligence-platform-pipeline-duval-fl/        ← separate git repo
├── infra/                    # CDK infrastructure
│   ├── bin/
│   └── lib/
│       ├── pipeline-stack.ts
│       └── frontend-stack.ts
├── pipeline/                 # Backend pipeline services
│   ├── src/
│   │   ├── workflows/        # Restate durable workflows
│   │   │   ├── county-ingest.ts
│   │   │   ├── ingest-chunk.ts
│   │   │   └── publish.ts
│   │   ├── services/         # Restate services
│   │   │   ├── parcel.ts
│   │   │   ├── loader.ts
│   │   │   └── webhook.ts
│   │   ├── transforms/       # Duval-specific transform handlers
│   │   │   └── duval/
│   │   ├── sources/          # Data source adapters
│   │   │   ├── appraiser.ts
│   │   │   ├── permits.ts
│   │   │   ├── ownership.ts
│   │   │   └── geo.ts
│   │   └── lib/              # Shared utilities
│   │       ├── filebase.ts
│   │       ├── ipns.ts
│   │       ├── duckdb.ts
│   │       └── provenance.ts
│   ├── data/
│   │   └── seeds/
│   │       └── duval.csv
│   └── tests/
│       ├── unit/
│       └── integration/
├── frontend/                 # Operator UI
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── dashboard.tsx
│   │   │   ├── pipeline-runs.tsx
│   │   │   ├── property-search.tsx
│   │   │   └── agent-chat.tsx
│   │   └── services/
│   └── tests/
├── agent/                    # Natural-language agent
│   ├── src/
│   │   ├── agent.ts          # Vercel AI SDK agent
│   │   └── tools/            # Agent tools (DuckDB queries)
│   └── tests/
├── mcp/                      # MCP server for Duval
│   ├── src/
│   └── tests/
├── docker-compose.yml        # Local: Restate + Postgres
├── package.json
└── tsconfig.json
```

**Structure Decision**: Web application with separate backend (pipeline services), frontend (operator UI), agent, and MCP server — all TypeScript. The pipeline uses Restate for durable workflows following the oracle-node pattern. Infrastructure via CDK.

## Kit Alignment

### Builder Agent: Oracle

The soofi-xyz-team-kit **Oracle agent** (`agents/oracle.md`) is the prescribed builder for this task. It orchestrates `elephant-xyz/skills` against the `oracle-node` pipeline. Reference implementation: Lee County, FL (~512k properties). Our Duval pipeline follows the same pattern, adapted for Duval County.

**Routing confirmation**: Arceus (master router) routes property ingestion + IPFS publishing tasks to the Oracle agent.

### Skills Driven

The pipeline implementation drives these `elephant-xyz/skills` in sequence — each is a defined skill, not custom architecture:

| Step | Skill | What It Does |
|------|-------|-------------|
| 1 | `bootstrap-oracle-infra` | Docker stack (Restate + Postgres), data dirs, services |
| 2 | `county-discovery` | Catalog Duval appraiser/permit portals and sources |
| 3 | `county-seed-data` | Generate parcel roll → `data/seeds/duval.csv` |
| 4 | `county-appraisal-onboarding` | Browser flow, transform scripts, smoke test |
| 5 | `validate-county-transform` | Validate 10-20 diverse parcels, 100% field coverage |
| 6 | `county-permit-adapter` | Duval permit portal harvester |
| 7 | `county-ingest-run` (pilot) | ~25 parcels end-to-end verification |
| 8 | `county-ingest-run` (full) | Full county with backpressure feeder |
| 9 | `sunbiz-corporate-ingest` | FL statewide corporate data |
| 10 | `bbb-harvest` | Contractor reputation enrichment |
| 11 | `query-db-loading-matching` | Reconcile + verify folio counts |
| 12 | `county-open-data-publish` | Export + upload + IPNS (gated) |
| 13 | `county-query-table-publish` | Parquet export + upload + IPNS + MCP wire |
| 14 | `deploy-open-data-mcp` | Add Duval to MCP IPNS maps |

### Kit Skills Used

| Skill | Purpose |
|-------|---------|
| `use-oracle` | Primary — drives onboard-county + stage skills on oracle-node pipeline |
| `apply-engineering-guidelines` | Golden Path baseline (TypeScript, CDK, Vercel AI SDK, PagerDuty, Powertools) |
| `use-elephant-mcp` | Verify published data is queryable via MCP |
| `use-elephant-query-db` | Pattern for Neon query DB consumption with Drizzle |

### Extensions Beyond the Kit

These capabilities are required by the spec but not covered by existing skills:

| Extension | Why Needed | Implementation Approach |
|-----------|-----------|------------------------|
| Webhook signaling | CRM integration contract (R2) | Add webhook dispatch to Publish virtual object post-IPNS-update |
| Delta metadata | CRM needs per-run change detection | Leverage Loader watermark diffs; publish `delta.json` alongside index |
| Operator UI | Pipeline monitoring + demo requirement | React frontend wrapping Restate state + run history |
| Proximity queries | 6 required query types (transit, Starbucks, water) | Pre-compute derived signals at ingestion from GTFS, OSM, NHD |
| Natural-language agent | Stakeholder requirement for RAG-backed Q&A | Vercel AI SDK + DuckDB tool calling over published Parquet |

### Supporting Agents

| Agent | Role |
|-------|------|
| **Arceus** | Validates Oracle is the correct agent; confirms skill routing |
| **Donphan** | Explores/verifies published MCP data post-publish |
| **Metagross** | Reference for monorepo scaffolding pattern (Turborepo, Amplify, CDK) |

## Complexity Tracking

No constitution violations to justify.
