# Implementation Guide

## Architecture

Turborepo monorepo with two packages:

- **Frontend** (`apps/web`): Next.js 14 deployed to AWS Amplify
- **Backend** (`apps/api`): tRPC router deployed as AWS Lambda behind API Gateway

### Client-Side Data Layer

- **DuckDB-WASM** runs in the browser for map and criteria queries
- Parquet files loaded via HTTP range requests (lazy, no full download)
- Data discovered through IPNS: `IPNS → index.json → query_table_cid → Parquet URL`
- IPNS resolution cached in `localStorage` with 30-minute TTL

### Server-Side

- **Neon Postgres** with Drizzle ORM for CRM state: opportunities, notifications, saved searches
- **tRPC Lambda** handles mutations, webhook ingestion, and agent proxy
- **Vercel AI SDK** with Claude Haiku for agent chat

### Agent Chat

- Agent queries route through the pipeline CloudFront API (`/api/agent/chat`)
- DuckDB on EC2 executes the actual SQL against published Parquet
- Neighborhood-to-ZIP mapping covers 10 Jacksonville neighborhoods for natural language queries

### Webhook Integration

- Endpoint at `/webhook/pipeline` receives pipeline publish events
- Triggers notification creation and saved-search matching

## Key URLs

| Resource | URL |
|----------|-----|
| Frontend | https://feature-003-residential-jax-crm.d2nys96ft16522.amplifyapp.com |
| API | https://42trwtmqqe.execute-api.us-east-2.amazonaws.com |
| Pipeline API (agent) | https://d5sfa8vgu8mcx.cloudfront.net/api/agent/chat |

## Data Flow

```
Pipeline IPNS → index.json → query_table_cid → Parquet URL
  |
  |-- Client DuckDB-WASM: HTTP range requests for map/criteria (lazy, ~3s init)
  |
  +-- Agent: calls pipeline CloudFront API → DuckDB on EC2 → results
```

## Features

### Property Discovery
- **Map view** with viewport-based "Search this area" queries
- **Split view**: map + list side-by-side
- **List view** with sortable property cards
- **Search criteria**: value range, ownership tenure, roof age, water proximity, regional owner, ZIP codes

### Agent Chat
- Natural language queries translated to DuckDB SQL
- Neighborhood-to-ZIP mapping for 10 Jacksonville neighborhoods
- Results rendered as property cards with map pins

### CRM Workflows
- **Opportunity pipeline**: Identified → Contacted → Negotiating → Under Contract → Closed
- **Saved searches** with proactive matching on new pipeline data
- **Webhook notifications** from pipeline runs
- **CSV export** for offline analysis

## Performance Optimizations

- **Parallel init**: DuckDB-WASM initialization and IPNS resolution run concurrently via `Promise.all`
- **localStorage IPNS cache**: 30-minute TTL avoids redundant IPNS lookups
- **Skip HEAD validation**: Cached Parquet URLs skip the gateway HEAD check
- **First render**: ~3 seconds (down from ~15 seconds before optimizations)

## Infrastructure

- **Region**: us-east-2
- **Frontend**: AWS Amplify (branch-based deploys)
- **Backend**: Lambda behind API Gateway
- **Database**: Neon Postgres (Drizzle ORM, remote connection)
- **Agent model**: `claude-haiku-4-5-20251001` via Vercel AI SDK

## Kit Agents Used

| Agent | Role |
|-------|------|
| `metagross` | Fullstack Turborepo scaffolding, tRPC, Amplify, CDK |
| `audino` | Frontend bug fixes and design comparison |
| `ash` | AI agent chat implementation |
| `apply-engineering-guidelines` | Baseline skill (Powertools, PagerDuty, CloudWatch, Vitest) |

## Root Repo

This repo is a git submodule of the [Elephant orchestration repo](https://github.com/trasgo-furioso/elephant), which manages specs, e2e tests, and submodule pointers for the integrated Oracle + CRM system.
