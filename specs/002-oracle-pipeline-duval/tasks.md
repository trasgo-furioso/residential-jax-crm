# Tasks: Oracle Pipeline — Duval County

**Input**: Design documents from `specs/002-oracle-pipeline-duval/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/webhook-event.md, contracts/published-artifact.md, quickstart.md

**Organization**: Tasks are grouped by user story (P1-P5 from spec.md). Implementation agents work inside `oracle-property-intelligence-platform-pipeline-duval-fl/` (delivery repo).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup — CDK Infrastructure, Scaffolding, Deploy to EC2

**Purpose**: DEPLOYMENT-FIRST (Constitution III). Provision hosted runtime before any feature code. Single `npx cdk deploy --all` creates EC2 + Amplify + Lambda.

- [x] T001 [P] [SETUP] Create monorepo root with `package.json`, `tsconfig.json`, `tsconfig.base.json`, `.nvmrc` (Node 22.18), `.prettierrc`, `.eslintrc.cjs` at `oracle-property-intelligence-platform-pipeline-duval-fl/package.json`
- [x] T002 [P] [SETUP] Create `oracle-property-intelligence-platform-pipeline-duval-fl/docker-compose.yml` with Restate 1.7 (ports 8080, 9070), Postgres 16 (port 5432, volume at /data/postgres), pipeline services (port 9080)
- [x] T003 [P] [SETUP] Create CDK app entry at `oracle-property-intelligence-platform-pipeline-duval-fl/infra/bin/app.ts` that instantiates PipelineStack, FrontendStack, and AgentStack
- [x] T004 [P] [SETUP] Create `oracle-property-intelligence-platform-pipeline-duval-fl/infra/lib/pipeline-stack.ts` — EC2 t3.large (us-east-2), security group (443 HTTPS, 22 SSH), 100GB gp3 EBS volume, IAM role, user-data script that installs Docker, runs `docker compose up -d`, configures Nginx reverse proxy with Caddy/certbot for HTTPS (`/api/*` -> :9080, `/restate` -> :9070)
- [x] T005 [P] [SETUP] Create `oracle-property-intelligence-platform-pipeline-duval-fl/infra/lib/frontend-stack.ts` — Amplify app connected to delivery repo, auto-build React frontend on push, custom domain configuration, environment variables for API base URL
- [x] T006 [P] [SETUP] Create `oracle-property-intelligence-platform-pipeline-duval-fl/infra/lib/agent-stack.ts` — Lambda function for Vercel AI SDK agent (DuckDB + httpfs), Lambda function for MCP server, API Gateway with routes `/agent` and `/mcp`, IAM roles for DuckDB httpfs access to Filebase
- [x] T007 [SETUP] Create `oracle-property-intelligence-platform-pipeline-duval-fl/infra/package.json` and `oracle-property-intelligence-platform-pipeline-duval-fl/infra/tsconfig.json` with CDK dependencies (`aws-cdk-lib`, `constructs`, `@aws-cdk/aws-amplify-alpha`)
- [x] T008 [SETUP] Create `oracle-property-intelligence-platform-pipeline-duval-fl/.env.example` with all required env vars: `FILEBASE_ACCESS_KEY`, `FILEBASE_SECRET_KEY`, `FILEBASE_BUCKET_OPEN_DATA`, `FILEBASE_BUCKET_QUERY_TABLE`, `WEBHOOK_URLS`, `WEBHOOK_SECRET`, `DATABASE_URL`, `RESTATE_RUNTIME_ENDPOINT`, AWS credentials
- [x] T009 [SETUP] Scaffold empty directory structure for pipeline (`pipeline/src/workflows/`, `pipeline/src/services/`, `pipeline/src/transforms/duval/`, `pipeline/src/sources/`, `pipeline/src/lib/`, `pipeline/data/seeds/`, `pipeline/tests/unit/`, `pipeline/tests/integration/`), frontend (`frontend/src/pages/`, `frontend/src/components/`, `frontend/src/services/`), agent (`agent/src/tools/`, `agent/tests/`), mcp (`mcp/src/`, `mcp/tests/`) inside `oracle-property-intelligence-platform-pipeline-duval-fl/`
- [x] T009b [SETUP] Write deploy verification test at `oracle-property-intelligence-platform-pipeline-duval-fl/infra/tests/verify-deploy.sh` — bash script that checks 9 acceptance signals via AWS CLI and curl: (1) PipelineStack CFN status is CREATE_COMPLETE/UPDATE_COMPLETE, (2) EC2 instance is running, (3) EC2 HTTPS responds 200, (4) FrontendStack CFN status, (5) CloudFront URL exists in stack outputs, (6) AgentStack CFN status, (7) Agent Lambda exists (`oracle-pipeline-duval-agent`), (8) MCP Lambda exists (`oracle-pipeline-duval-mcp`), (9) API Gateway `/agent` responds. Script reads stack outputs dynamically, retries curl checks up to 5x with 30s sleep for boot lag, prints colored pass/fail per signal, exits 0 only if ALL pass
- [x] T010 [SETUP] Deploy all CDK stacks — run `npm install`, `npx cdk bootstrap aws://626654731698/us-east-2`, `npx cdk deploy --all --require-approval never`. Then run `bash infra/tests/verify-deploy.sh` in a TDD loop: if test fails, read error, fix code, redeploy, rerun test until verify-deploy.sh exits 0

**Checkpoint**: Hosted runtime is live. EC2 running Restate + Postgres via Docker Compose, Nginx proxy with HTTPS, Amplify app created, Lambda functions deployed.

---

## Phase 2: Foundational — County Discovery, Seed Data, elephant-cli, Base Services

**Purpose**: Core infrastructure that MUST be complete before US1 can ingest data. Follows the 14-step pipeline sequence from plan.md (steps 1-6).

- [x] T011 [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/db.ts` — Postgres connection pool using `pg` or `postgres` package, connection from `DATABASE_URL` env var, typed query helpers, migration runner
- [x] T012 [FOUND] Create database migration `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/migrations/001-initial-schema.sql` — tables for `pipeline_runs` (run_id UUID PK, county, started_at, completed_at, status enum, record_count, delta_new, delta_updated, delta_removed, source_limitations jsonb, published_artifact_cid, ipns_pointer), `data_sources` (source_id PK, name, category enum, url, collection_method enum, last_successful_run, record_count, limitations), `properties` (uuid PK, parcel_id unique, address jsonb, county_jurisdiction, assessed_value, market_value, ownership jsonb, current_owner jsonb, permits jsonb, structure jsonb, lot jsonb, coordinates geometry, tax jsonb, provenance jsonb, derived_signals jsonb), `run_sources` (run_id FK, source_id FK, records_ingested, duration_ms, status, limitations)
- [x] T013 [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/provenance.ts` — helper to create and merge Provenance metadata objects (contributing_sources, collection_timestamps, last_pipeline_run, reconciliation_confidence), attach provenance to every record insert/update
- [x] T014 [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/filebase.ts` — S3 client wrapper for Filebase (using `@aws-sdk/client-s3`), upload functions for JSON and Parquet files to per-county buckets (`elephant-oracle-open-data-duval`, `elephant-oracle-query-table-duval`), CID pre-computation with `ipfs-only-hash`
- [x] T015 [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/ipns.ts` — IPNS pointer management via Filebase API, function to update IPNS label (`oracle-open-data-duval`, `oracle-query-table-duval`) to point to new CID, function to resolve current IPNS pointer
- [x] T016 [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/duckdb.ts` — DuckDB in-process instance setup, httpfs extension loading, helper to create view over published Parquet at `https://ipfs.filebase.io/ipns/<key>/query-tables/duval/query-table.parquet`, typed query execution
- [x] T017 [FOUND] County Discovery (skill step 2) — create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/duval-catalog.ts` cataloging all Duval County data sources: appraiser portal (https://paopropertysearch.coj.net), permits portal, ownership records, business tax receipts, contractor licensing, GIS/coordinate data. Each entry has source_id, name, category, url, collection_method, known limitations
- [x] T018 [FOUND] County Seed Data (skill step 3) — create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/data/seeds/duval.csv` with Duval County parcel roll seed data (parcel IDs/RE numbers). Create seed loader script at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/seeds/load-seed.ts` that imports the CSV into the properties table as skeleton records
- [x] T019 [FOUND] County Appraisal Onboarding (skill step 4) — implement browser flow source adapter at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/appraiser.ts` using Playwright to navigate Duval Property Appraiser portal, extract property details (parcel ID, address, assessed value, year built, sqft, owner, sale history). Include rate limiting and retry logic
- [x] T020 [FOUND] Implement transform handler at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/appraiser-transform.ts` — normalize raw appraiser data into Lexicon-aligned Property Record schema (as defined in data-model.md), compute derived_signals.roof_age_years from year_built or roof permit date, RFC 8785 canonical JSON
- [x] T021 [FOUND] Validate County Transform (skill step 5) — create integration test at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/tests/integration/appraiser-transform.test.ts` validating 10-20 diverse parcels through the appraiser source adapter + transform, asserting 100% field coverage per Lexicon schema
- [x] T022 [FOUND] County Permit Adapter (skill step 6) — implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/permits.ts` to harvest Duval County building permits, extract permit type, date, description, and link permits to properties by parcel ID. Create corresponding transform at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/permits-transform.ts`
- [x] T023 [P] [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/ownership.ts` — ownership transfer records source adapter. Create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/ownership-transform.ts` to compute derived_signals.ownership_tenure_years, derived_signals.is_regional_owner from owner mailing address comparison
- [x] T024 [P] [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/geo.ts` — GIS/coordinate data source adapter (Duval County GIS parcel centroids). Create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/geo-transform.ts` for coordinate normalization
- [x] T025 [FOUND] Implement proximity signal computation at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/proximity-signals.ts` — download JTA GTFS feed (transit stops), query Overpass/OSM for Starbucks locations in Duval County, download NHD waterline data from USGS. Compute derived_signals: transit_distance_mi, starbucks_distance_mi, water_proximity_ft, within_walking_transit (<0.5mi), within_walking_starbucks (<0.5mi), is_waterfront (<500ft). Store as pre-computed attributes on property records
- [x] T026 [FOUND] Implement Restate service registration at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/services/index.ts` — register all Restate services and virtual objects (parcel, loader, webhook) with the Restate runtime. Create npm script `register` in `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/package.json`
- [x] T027 [FOUND] Implement `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/services/loader.ts` — Restate virtual object for loading transformed records into Postgres. Track content-aware watermarks for incremental detection (compare incoming record hash against stored hash). Return delta counts (new, updated, removed) per source
- [x] T028 [FOUND] Implement reconciliation logic at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/services/parcel.ts` — Restate virtual object keyed by parcel_id. Merge records from multiple sources (appraiser, permits, ownership, geo) into a single unified Property Record. Use matching signals: parcel_id (primary), address normalization (secondary), owner name (tertiary). Set reconciliation_confidence score. Preserve all source provenance

**Checkpoint**: All source adapters, transforms, database schema, Restate services, and shared libraries are ready. Pipeline can be wired together in US1.

---

## Phase 3: US1 — Continuous Incremental Ingestion (Priority: P1)

**Goal**: The operator triggers a pipeline run that ingests all Duval County sources, detects new/changed records, reconciles duplicates, preserves provenance, and is idempotent on re-run.

**Independent Test**: Run the pipeline twice. Verify second run ingests only new/changed records, no duplicates, provenance preserved.

### Implementation for US1

- [ ] T029 [US1] Implement county ingest workflow at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/workflows/county-ingest.ts` — Restate durable workflow that: creates a pipeline_run record (status=running), iterates over all sources from duval-catalog.ts, invokes ingest-chunk workflow per source, aggregates delta counts, updates pipeline_run status to success/partial/failed, records source_limitations
- [ ] T030 [US1] Implement ingest chunk workflow at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/workflows/ingest-chunk.ts` — Restate durable workflow for single-source ingestion: call source adapter (appraiser, permits, ownership, geo), call transform handler, call loader service to upsert records with watermark comparison, return per-source delta and timing
- [ ] T031 [US1] Implement business source adapter at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/business.ts` — Duval County business tax receipt records. Create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/business-transform.ts` to normalize business records and link to properties by address
- [ ] T032 [US1] Implement contractor source adapter at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/contractor.ts` — Duval County contractor licensing records. Create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/contractor-transform.ts` to normalize contractor records
- [ ] T033 [US1] Implement SunBiz corporate ingest (skill step 9) at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/sunbiz.ts` — Florida statewide corporate data from SunBiz. Create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/sunbiz-transform.ts` to enrich ownership records with corporate entity data
- [ ] T034 [US1] Implement BBB harvest (skill step 10) at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/sources/bbb.ts` — Better Business Bureau contractor reputation data. Create `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/transforms/duval/bbb-transform.ts` to enrich contractor records
- [ ] T035 [US1] Implement backpressure feeder at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/feeder.ts` — chunked parcel processing for full county ingestion (skill step 8). Configurable batch size, concurrency limits, progress tracking. Used by county-ingest workflow for large-scale runs
- [ ] T036 [US1] Implement idempotency guards in `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/services/loader.ts` — ensure re-runs do not duplicate data: use parcel_id as natural key, compare content hashes before insert/update, track watermark per source per parcel. On interrupted run, resume from last committed batch
- [ ] T037 [US1] Create pilot ingestion script (skill step 7) at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/scripts/pilot-ingest.ts` — run county-ingest workflow with `--limit 25` to verify end-to-end flow for ~25 parcels. Add npm script `ingest` to `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/package.json` with `--county` and `--limit` flags
- [ ] T038 [US1] Run full county ingestion (skill step 8) — execute `npm run ingest -- --county duval` for full Duval County (~200k-400k properties). Verify: all 6 source categories ingested, record_count > 100k, provenance on 100% of records, no duplicate parcel_ids
- [ ] T039 [US1] Query DB loading + matching verification (skill step 11) — implement verification script at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/scripts/verify-ingest.ts` that checks: total property count, per-source record counts, reconciliation results (folio count matches), provenance completeness, derived signal coverage. Add npm script `verify`

**Checkpoint**: Pipeline ingests all Duval County sources incrementally. Second run detects only changes. All records have provenance. Reconciliation merges cross-source duplicates.

---

## Phase 4: US2 — IPFS Publishing + IPNS + Webhook Signaling (Priority: P2)

**Goal**: After successful ingestion, publish full-snapshot artifact with delta metadata to Elephant IPFS, update IPNS pointer, send webhook event to consumers.

**Independent Test**: Complete a pipeline run, verify CID created on IPFS, IPNS pointer updated, webhook delivered to test endpoint.

### Implementation for US2

- [ ] T040 [US2] Implement publish workflow at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/workflows/publish.ts` — Restate durable workflow (skill step 12): export all property records to per-property JSON files following Lexicon schema (contracts/published-artifact.md layout), generate `index.json` with county, property_count, shard_count, `manifest.json`, compute `delta.json` by diffing current snapshot against previous run's manifest, upload to Filebase bucket `elephant-oracle-open-data-duval`, pre-compute CIDv1+SHA-256 with `ipfs-only-hash`, update IPNS pointer `oracle-open-data-duval`
- [ ] T041 [US2] Implement query table publish (skill step 13) at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/workflows/publish-query-table.ts` — export all property records to single Parquet file (`query-table.parquet`) with all searchable columns including derived_signals (roof_age_years, ownership_tenure_years, is_regional_owner, water_proximity_ft, transit_distance_mi, starbucks_distance_mi). Upload to Filebase bucket `elephant-oracle-query-table-duval` at path `query-tables/duval/query-table.parquet`. Update IPNS pointer `oracle-query-table-duval`
- [ ] T042 [US2] Implement webhook dispatch service at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/services/webhook.ts` — Restate service that sends HTTP POST to each registered webhook URL (from `WEBHOOK_URLS` env var) after publish completes. Payload follows contracts/webhook-event.md: event_id, event_type `artifact.published`, county, run_id, ipns_pointer, artifact_cid, timestamp, delta summary. Include headers: `Content-Type: application/json`, `X-Event-Id`, `X-Webhook-Signature` (HMAC-SHA256 with `WEBHOOK_SECRET`). Retry 3 times with exponential backoff (5s, 30s, 120s). 10s timeout per attempt. Non-blocking: webhook failure does not fail the pipeline run
- [ ] T043 [US2] Wire publish step into county-ingest workflow — update `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/workflows/county-ingest.ts` to call publish workflow after successful ingestion, then call webhook service after successful publish. Update pipeline_run record with published_artifact_cid and ipns_pointer
- [ ] T044 [US2] Add npm scripts to `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/package.json`: `publish` (run publish workflow independently for a county), `query` (run arbitrary SQL against DuckDB over published Parquet via httpfs)
- [ ] T045 [US2] Deploy updated pipeline to EC2 — push new pipeline services, verify: `npm run ingest -- --county duval` completes, artifact appears on Filebase IPFS, `curl -I https://ipfs.filebase.io/ipns/<key>/index.json` returns 200, webhook is delivered to test endpoint

**Checkpoint**: Full pipeline cycle works: ingest -> reconcile -> publish to IPFS -> update IPNS -> deliver webhook. CID is content-addressed, delta.json is accurate, webhook payload matches contract.

---

## Phase 5: US3 — Pipeline Run History UI (Priority: P3)

**Goal**: Operator views chronological pipeline run history with deltas, source details, published artifacts, and source limitations via Dashboard and Pipeline Runs pages.

**Independent Test**: After multiple runs, verify UI shows run history with accurate counts and deltas, expandable run details, IPFS artifact links.

### Implementation for US3

- [ ] T046 [P] [US3] Create React frontend project at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/` — initialize with Vite + React + TypeScript, install Shadcn/ui, Tailwind CSS, TanStack Table, TanStack Query, React Router. Create `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/package.json`, `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/vite.config.ts`, `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/tailwind.config.ts`, `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/tsconfig.json`
- [ ] T047 [P] [US3] Implement pipeline API endpoints at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/api/routes.ts` — Express/Hono HTTP server (port 9080) with routes: `GET /api/runs` (list pipeline runs with pagination), `GET /api/runs/:id` (single run with source details), `GET /api/sources` (list data sources with health), `GET /api/stats` (dashboard summary: total properties, last run, IPNS status, source count), `POST /api/runs/trigger` (trigger new pipeline run). JSON responses typed from data-model.md entities
- [ ] T048 [US3] Implement shell layout at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/components/layout/shell.tsx` — fixed 200px sidebar (collapsible to icons) with nav items (Dashboard, Pipeline Runs, Property Search, Agent Chat), bottom section showing county summary stats (Duval FL, record count, source count). Top bar with app title "ORACLE PIPELINE -- DUVAL COUNTY", IPNS health indicator (Live/Stale), last run time. React Router outlet for page content
- [ ] T049 [US3] Implement API client at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/services/api.ts` — typed fetch wrapper for all `/api/*` endpoints, TanStack Query hooks: `useRuns()`, `useRun(id)`, `useSources()`, `useStats()`, `useTriggerRun()`
- [ ] T050 [US3] Implement Dashboard page at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/pages/dashboard.tsx` — 4 stat cards (Total Properties with delta, Last Run time with delta counts, IPNS Status with CID prefix, Sources health count). Records by Source table (TanStack Table: source name, record count, last collected timestamp, status badge). Elephant IPFS & MCP section showing Open Data IPNS, Query Table IPNS with Live/Stale indicator and Gateway link, MCP endpoint with connection status
- [ ] T051 [US3] Implement Pipeline Runs page at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/pages/pipeline-runs.tsx` — Trigger Run button (calls POST /api/runs/trigger), chronological table (TanStack Table: run number, timestamp, new/updated/removed counts, status badge). Expandable rows: click to expand showing sources ingested (per-source: name, records, avg time, issues), published artifact (CID, IPNS pointer), webhook delivery status (HTTP code, latency), limitations. Pagination
- [ ] T052 [US3] Deploy frontend to Amplify — push React app, verify: Amplify auto-builds and deploys, Dashboard page loads at deployed URL showing real pipeline stats, Pipeline Runs page shows run history with expandable details

**Checkpoint**: Operator can view Dashboard with live stats and Pipeline Runs with full history. IPNS health indicators work. Source details are expandable.

---

## Phase 6: US4 — Property Intelligence Queries (Priority: P4)

**Goal**: Users query property data through Property Search page (6 required query types) and Agent Chat page (natural-language queries), all with source-backed evidence.

**Independent Test**: Run each of 6 query types through UI and agent, verify results with source provenance.

### Implementation for US4

- [ ] T053 [US4] Implement query API endpoints at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/api/query-routes.ts` — `GET /api/properties/search?query=<type>&params=<json>` for the 6 required query types (roof_age_gt_15, water_view, ownership_tenure_gt_10, regional_owners, transit_walking, starbucks_walking). Each query runs against Postgres using derived_signals columns. Returns paginated results with full property details and provenance. `GET /api/properties/:parcel_id` for single property detail with all attributes and source provenance
- [ ] T054 [US4] Implement Property Search page at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/pages/property-search.tsx` — Query selector dropdown with 6 options (Roofs older than 15 years, View of water, No ownership change in 10+ years, Regional owners, Walking distance to public transit, Walking distance to Starbucks). Results count and Export CSV button. TanStack Table with columns: Parcel ID, Address, Value, Signal (adapts to selected query type per plan.md wireframe), Sources count. Click any row to open property detail drawer
- [ ] T055 [US4] Implement property detail drawer component at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/components/property-detail-drawer.tsx` — slide-out panel showing: parcel ID, full address, assessed value, year built, sqft, current owner, roof age, last sale date, water proximity, transit distance, Starbucks distance, regional owner status. Source Provenance section listing each contributing source with collection timestamp and pipeline run reference. Reconciliation confidence score
- [ ] T056 [US4] Implement agent backend at `oracle-property-intelligence-platform-pipeline-duval-fl/agent/src/agent.ts` — Vercel AI SDK agent using `ai` package with `generateText`/`streamText`. Model: Claude or GPT-4. System prompt: "You are a Duval County property intelligence assistant. Answer questions about properties using the available tools. Always cite source provenance." Tools: queryProperties (DuckDB SQL over published Parquet via httpfs), getPropertyDetail (lookup by parcel_id), getRunHistory (recent pipeline runs)
- [ ] T057 [US4] Implement agent DuckDB tools at `oracle-property-intelligence-platform-pipeline-duval-fl/agent/src/tools/query-properties.ts` — tool definition for Vercel AI SDK: accepts natural language query, translates to DuckDB SQL over published Parquet at `https://ipfs.filebase.io/ipns/<key>/query-tables/duval/query-table.parquet`, returns results with source provenance. Include tool at `oracle-property-intelligence-platform-pipeline-duval-fl/agent/src/tools/property-detail.ts` for single-property lookup
- [ ] T058 [US4] Implement agent API route at `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/api/agent-routes.ts` — `POST /api/agent/chat` accepting `{ messages: Message[] }`, streaming response using Vercel AI SDK `streamText`. Wire to agent instance from agent/src/agent.ts. Include `GET /api/agent/health` endpoint
- [ ] T059 [US4] Implement Agent Chat page at `oracle-property-intelligence-platform-pipeline-duval-fl/frontend/src/pages/agent-chat.tsx` — Vercel AI SDK `useChat` hook connected to `POST /api/agent/chat`. Message list with user/agent bubbles. Agent responses show: answer text, result cards with source provenance (parcel ID, address, signal values, source list, run reference), DuckDB query executed, data freshness (last run timestamp). Input field with Send button. "Ask about Duval County properties..." placeholder
- [ ] T060 [US4] Deploy updated frontend and agent — push changes, verify: Property Search page shows results for all 6 query types with correct signals, property detail drawer displays full attributes and provenance, Agent Chat responds to multi-attribute queries with source-backed evidence within 10 seconds

**Checkpoint**: All 6 property intelligence query types work in Property Search. Agent Chat handles natural-language queries with tool-calling and source-backed responses. All results include provenance.

---

## Phase 7: US5 — MCP-Ready Access (Priority: P5)

**Goal**: Expose data through MCP-compatible interface that resolves published Elephant IPFS/IPNS artifacts. External tools query the dataset without Oracle-hosted infrastructure.

**Independent Test**: Connect MCP client, resolve IPNS artifacts, execute structured query, receive results.

### Implementation for US5

- [ ] T061 [US5] Implement MCP server at `oracle-property-intelligence-platform-pipeline-duval-fl/mcp/src/server.ts` — MCP-compatible server (skill step 14: deploy-open-data-mcp) using `@elephant-xyz/mcp` or standard MCP SDK. Register tools: `listOracleProperties` (list available counties and their IPNS pointers), `queryProperties` (execute DuckDB SQL against published Parquet via IPNS-resolved URL), `getPropertyDetail` (lookup single property by parcel_id from published JSON). Configure IPNS map from env var `ORACLE_OPEN_DATA_IPNS_MAP` (JSON: `{"duval":"<ipns-key>"}`)
- [ ] T062 [US5] Implement MCP handler at `oracle-property-intelligence-platform-pipeline-duval-fl/mcp/src/handlers/duval.ts` — county-specific handler that resolves `oracle-open-data-duval` and `oracle-query-table-duval` IPNS pointers, reads published Parquet via DuckDB httpfs for query tools, reads per-property JSON via IPFS gateway for detail tools. Zero hosted database dependency — all reads from published IPFS data
- [ ] T063 [US5] Add MCP npm scripts to `oracle-property-intelligence-platform-pipeline-duval-fl/mcp/package.json`: `mcp:start` (start MCP server locally), `mcp:test` (run test queries against MCP). Add `oracle-property-intelligence-platform-pipeline-duval-fl/mcp/tsconfig.json`
- [ ] T064 [US5] Deploy MCP endpoint — Lambda function already provisioned in AgentStack (T006). Deploy MCP server code. Verify: MCP endpoint at `https://<host>/mcp` is reachable, `listOracleProperties` returns Duval with IPNS pointer, `queryProperties` returns results from published Parquet without any hosted DB

**Checkpoint**: MCP interface is live. External tools can discover and query Duval County data via IPNS-resolved IPFS artifacts without any Oracle-hosted infrastructure.

---

## Phase 8: Polish — Observability, Final Deploy, Demo

**Purpose**: Cross-cutting concerns, production hardening, demo recording.

- [ ] T065 [P] [POLISH] Add Powertools observability to all pipeline services — integrate `@aws-lambda-powertools/logger`, `@aws-lambda-powertools/tracer`, `@aws-lambda-powertools/metrics` in `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/src/lib/observability.ts`. Add structured logging to every workflow step, Restate service call, and source adapter. Register CloudWatch metrics in `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/cloudwatch-metrics.json` per Lexicon
- [ ] T066 [P] [POLISH] Configure PagerDuty alerting — create `oracle-property-intelligence-platform-pipeline-duval-fl/infra/lib/alerting.ts` with CloudWatch alarms for: pipeline run failure, IPNS update older than 24h, webhook delivery failure rate > 50%, EC2 instance health. PagerDuty integration via SNS topic
- [ ] T067 [P] [POLISH] Add GitHub Actions CI at `oracle-property-intelligence-platform-pipeline-duval-fl/.github/workflows/ci.yml` — lint (Prettier + ESLint), type check (tsc), unit tests (vitest), build all packages (pipeline, frontend, agent, mcp, infra). Run on push and PR
- [ ] T068 [P] [POLISH] Add Vitest unit tests for critical paths: `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/tests/unit/provenance.test.ts` (provenance merge logic), `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/tests/unit/filebase.test.ts` (CID computation), `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/tests/unit/webhook.test.ts` (webhook retry logic), `oracle-property-intelligence-platform-pipeline-duval-fl/pipeline/tests/unit/reconciliation.test.ts` (parcel merging), `oracle-property-intelligence-platform-pipeline-duval-fl/agent/tests/agent.test.ts` (tool execution)
- [ ] T069 [POLISH] Create smoke test script at `scripts/smoke-test.sh` — curl deployed frontend URL (expect 200), curl /api/health (expect 200 with record count), POST /mcp with listOracleProperties (expect JSON response). Exit 0 if all pass, exit 1 if any fail
- [ ] T069b [POLISH] Run Slowking self-assessment against deployed runtime — provide assignment repo, deployed URL, credentials, and demo artifact as inputs. Execute all 3 pillars: evaluate-candidate-intent, evaluate-candidate-product (Playwright exercise), evaluate-candidate-implementation (code review + kit usage). Record scorecard output. Fix any gaps Slowking identifies, redeploy, and re-run until score is acceptable
- [ ] T070 [POLISH] Final deploy to production — ensure all CDK stacks are up-to-date (`npx cdk deploy --all`), EC2 pipeline services running latest code, Amplify frontend deployed with all 4 pages functional, Lambda agent/MCP endpoints responding. Verify hosted runtime is accessible without local setup (Constitution III)
- [ ] T071 [POLISH] Record demo video — walkthrough following the Demo Flow from plan.md: (1) Dashboard showing overview stats, records by source, IPFS/MCP status, (2) Pipeline Runs showing history with expanded run details, (3) Property Search running all 6 query types with detail drawer, (4) Agent Chat with 3 multi-attribute queries showing source-backed evidence. Save demo artifact

**Checkpoint**: All user stories implemented and verified. Observability, alerting, and CI in place. Demo recorded. Hosted runtime accessible and submission-ready.

---

## Phase 9: E2E Validation & Demo Recording

**Purpose**: Playwright tests exercising all user stories against the deployed runtime. Video recording serves as demo artifact.

- [ ] T072 [E2E] Set up Playwright in delivery repo — create `e2e/` directory with `playwright.config.ts`, install `@playwright/test`, configure video recording (on for all tests), set baseURL to `https://d5sfa8vgu8mcx.cloudfront.net`, create npm scripts `test:e2e` and `test:e2e:headed`
- [ ] T073 [E2E] Dashboard validation test (`e2e/tests/dashboard.spec.ts`) — verify stat cards render with data (Total Properties > 0, Last Run timestamp, Sources count > 0), Records by Source table has rows, IPFS section shows IPNS pointer
- [ ] T074 [E2E] Pipeline Runs validation test (`e2e/tests/pipeline-runs.spec.ts`) — verify runs table has entries with status badges, Trigger Run button exists. Trigger a new run, wait for completion (poll /api/runs), verify new row appears with "Success" status
- [ ] T075 [E2E] Property Search validation test (`e2e/tests/property-search.spec.ts`) — iterate all 6 query types (roof_age_gt_15, water_view, ownership_tenure_gt_10, regional_owners, transit_walking, starbucks_walking), select each from dropdown, verify results table shows rows with parcel IDs
- [ ] T076 [E2E] Agent Chat validation test (`e2e/tests/agent-chat.spec.ts`) — send "How many properties are in the database?", wait for agent response (up to 30s), verify response contains a number. Send "Which properties have roofs older than 15 years?", verify response mentions properties
- [ ] T077 [E2E] Run full e2e suite with video recording against deployed runtime, verify all tests pass, collect video artifacts from `e2e/videos/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. DEPLOYMENT-FIRST.
- **Phase 2 (Foundational)**: Depends on Phase 1 (EC2 + Postgres running). BLOCKS all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 (source adapters, transforms, Restate services).
- **Phase 4 (US2)**: Depends on Phase 3 (ingested data to publish).
- **Phase 5 (US3)**: Depends on Phase 3 (pipeline runs to display). Can start in parallel with Phase 4.
- **Phase 6 (US4)**: Depends on Phase 3 (property data to query). Can start in parallel with Phase 4/5.
- **Phase 7 (US5)**: Depends on Phase 4 (published IPFS artifacts to resolve).
- **Phase 8 (Polish)**: Depends on all user stories being functional.
- **Phase 9 (E2E Validation)**: Depends on all user stories deployed and accessible at production URL.

### Parallel Opportunities

- Phase 1: T001-T009 can all run in parallel (different files)
- Phase 2: T023 and T024 can run in parallel; T011-T012 can run in parallel with T014-T016
- Phase 5 and Phase 6: Can start in parallel once US1 data is available (both read from Postgres/published data)
- Phase 8: T065-T068 can all run in parallel (different files, independent concerns)

### Critical Path

Setup (T001-T010) -> Foundational (T011-T028) -> US1 Ingestion (T029-T039) -> US2 Publishing (T040-T045) -> US5 MCP (T061-T064) -> Polish (T069-T071)

UI can branch off after US1: US1 -> US3 (Dashboard/Runs UI) and US1 -> US4 (Property Search/Agent Chat) in parallel.

### 14-Step Pipeline Sequence Mapping

| Step | Skill | Task(s) |
|------|-------|---------|
| 1 | bootstrap-oracle-infra | T001-T010 |
| 2 | county-discovery | T017 |
| 3 | county-seed-data | T018 |
| 4 | county-appraisal-onboarding | T019, T020 |
| 5 | validate-county-transform | T021 |
| 6 | county-permit-adapter | T022 |
| 7 | county-ingest-run (pilot) | T037 |
| 8 | county-ingest-run (full) | T035, T038 |
| 9 | sunbiz-corporate-ingest | T033 |
| 10 | bbb-harvest | T034 |
| 11 | query-db-loading-matching | T039 |
| 12 | county-open-data-publish | T040 |
| 13 | county-query-table-publish | T041 |
| 14 | deploy-open-data-mcp | T061-T064 |
