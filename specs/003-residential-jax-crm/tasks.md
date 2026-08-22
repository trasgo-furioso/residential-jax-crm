# Tasks: Residential Property Acquisition CRM

**Input**: Design documents from `specs/003-residential-jax-crm/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/webhook-receiver.md, quickstart.md

**Organization**: Turborepo monorepo (`apps/web/`, `apps/api/`, `packages/`). Tasks grouped by user story. Agent/skill references from plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Monorepo Scaffolding)

**Purpose**: Turborepo monorepo, pnpm workspace, shared configs
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `apply-engineering-guidelines`

- [x] T001 Initialize Turborepo monorepo with pnpm workspace — create pnpm-workspace.yaml, turbo.json, root package.json with workspace scripts
- [x] T002 Create packages/tsconfig/ with base.json, nextjs.json, node.json shared TypeScript configs (strict: true)
- [x] T003 Create apps/web/ — initialize Next.js 14+ App Router project with TypeScript, install maplibre-gl, react-map-gl, @duckdb/duckdb-wasm
- [x] T004 [P] Create apps/api/ — initialize TypeScript Lambda project, install @trpc/server, @trpc/server/adapters/aws-lambda, drizzle-orm, @neondatabase/serverless, ai, @ai-sdk/amazon-bedrock, @aws-lambda-powertools/logger, @aws-lambda-powertools/tracer, @aws-lambda-powertools/metrics, duckdb (Node bindings), zod
- [x] T005 [P] Create packages/shared/ with shared types in packages/shared/src/types/ — property.ts (Property, Owner, Provenance, DerivedSignals), crm.ts (Opportunity, OutreachRecord, Task, SavedCriteria, Notification), pipeline.ts (WebhookEvent, PipelineRun, DeltaSummary) per data-model.md
- [x] T006 [P] Create packages/api-client/ — tRPC client setup, AppRouter type export, React hooks for frontend consumption
- [x] T007 [P] Configure Vitest in apps/api/vitest.config.ts with TypeScript support and aws-sdk-client-mock
- [x] T008 [P] Configure ESLint + Prettier across workspace (root .eslintrc.json, .prettierrc)
- [x] T009 [P] Create .env.example with DATABASE_URL, WEBHOOK_SECRET, IPNS_OPEN_DATA_KEY, IPNS_QUERY_TABLE_KEY, BEDROCK_MODEL_ID, PAGERDUTY_ROUTING_KEY_SECRET_ARN
- [x] T010 Wire internal dependencies — apps/web depends on packages/api-client and packages/shared (workspace:*); apps/api depends on packages/shared (workspace:*)

**Checkpoint**: `pnpm turbo run build` succeeds across all apps and packages. `pnpm turbo run typecheck` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data access layers and tRPC backend skeleton that ALL user stories depend on
**Agent**: `metagross` | **Skills**: `use-elephant-query-db`, `use-elephant-mcp`, `build-frontend-backends`

**Data exploration prerequisite**: Use `donphan` agent with `use-elephant-mcp` skill to verify Duval property Parquet schema fields match data-model.md before building queries.

- [x] T011 Create tRPC Lambda entry point in apps/api/src/handler.ts — initialize Powertools Logger, Tracer, Metrics; use awsLambdaRequestHandler with appRouter
- [x] T012 Create tRPC context in apps/api/src/context.ts — pass Lambda event, context, Powertools instances to all procedures
- [x] T013 Create root tRPC router in apps/api/src/routers/index.ts — merge all domain routers, export AppRouter type
- [x] T014 Implement server-side DuckDB Node init and Parquet loading in apps/api/src/services/duckdb.ts (httpfs extension, IPNS URL resolution, CREATE VIEW for properties, queryProperties, queryPropertiesByCriteria)
- [x] T015 [P] Implement IPNS resolution helper in apps/api/src/services/ipfs.ts (resolve IPNS pointer to CID, construct Filebase gateway URLs)
- [x] T016 Define Drizzle ORM schema for all CRM tables in apps/api/src/lib/db/schema.ts (saved_criteria, pipeline_events, notifications, opportunities, opportunity_history, tasks, outreach_records — per data-model.md)
- [x] T017 Create Drizzle client with Neon serverless driver in apps/api/src/lib/db/index.ts
- [x] T018 Create drizzle.config.ts in apps/api/ and run initial migration to Neon with `drizzle-kit push`
- [x] T019 Implement client-side DuckDB-WASM init and queries in apps/web/src/lib/duckdb.ts (httpfs, IPNS URL, CREATE VIEW, queryProperties returning GeoJSON FeatureCollection)
- [x] T020 Create root layout with sidebar navigation in apps/web/src/app/layout.tsx (links: Map/Dashboard, Opportunities, Notifications)

**Checkpoint**: Server-side DuckDB loads Parquet from IPFS in Lambda. Client-side DuckDB-WASM loads in browser. Drizzle connects to Neon. tRPC endpoint responds. Layout renders.

---

## Phase 3: User Story 1 — Map-Based Property Discovery (Priority: P1) MVP

**Goal**: Interactive map centered on Jacksonville/Duval County showing ~245k residential properties with detail panel and list view.
**Independent Test**: Open CRM, verify properties render on map, click marker → detail, switch to list view. (V1 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `use-elephant-mcp`

- [x] T021 [US1] Create properties tRPC router in apps/api/src/routers/properties.ts (query procedure: return properties from server-side DuckDB as GeoJSON; getById procedure: return single property by parcel_id)
- [x] T022 [US1] Create PropertyMap component in apps/web/src/components/map/PropertyMap.tsx (center Jacksonville 30.3322/-81.6557, zoom 11, GeoJSON source with cluster layer)
- [x] T023 [P] [US1] Create PropertyMarker component in apps/web/src/components/map/PropertyMarker.tsx (popup on click: parcel ID, address, assessed value)
- [x] T024 [US1] Create PropertyDetail panel in apps/web/src/components/properties/PropertyDetail.tsx (parcel ID, address, owner, assessed value, ownership tenure, roof age, coordinates, provenance with sources, pipeline run, timestamps)
- [x] T025 [P] [US1] Create PropertyList component in apps/web/src/components/properties/PropertyList.tsx (sortable table: parcel ID, address, owner, assessed value, tenure years, roof age; click row selects on map)
- [x] T026 [US1] Create main dashboard page in apps/web/src/app/page.tsx (split layout: map left, list/detail right; synchronized selection; map/list/split toggle)

**Checkpoint**: Map displays Duval properties with clustering. Click marker → detail panel. Switch to list → sortable table. V1 validated.

---

## Phase 4: User Story 2 — Criteria Search and Saved Searches (Priority: P1)

**Goal**: Define, apply, and save acquisition criteria with percentage match scoring and geographic filtering.
**Independent Test**: Define criteria, verify matches ranked, save search, recall it. (V2 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `use-elephant-mcp`

- [x] T027 [US2] Implement criteria matcher service in apps/api/src/services/criteria-matcher.ts (evaluate property against filter set, return percentage score + per-criterion breakdown; filters: ownership_tenure_min_years, roof_age_min_years, zip_codes, assessed_value_min/max, is_regional_owner, water_proximity_max_ft)
- [x] T028 [US2] Create criteria tRPC router in apps/api/src/routers/criteria.ts (list, create, getById, update, delete procedures with Zod input validation — persist to saved_criteria table)
- [x] T029 [US2] Add searchByCriteria procedure to properties tRPC router in apps/api/src/routers/properties.ts (builds DuckDB WHERE clause from filters, returns matched properties with match scores)
- [x] T030 [US2] Create SearchCriteria form component in apps/web/src/components/properties/SearchCriteria.tsx (inputs for each filter type, apply, clear, save buttons — calls tRPC via api-client)
- [x] T031 [US2] Create DrawControl component in apps/web/src/components/map/DrawControl.tsx (MapLibre draw for polygon/radius, emit GeoJSON)
- [x] T032 [US2] Integrate criteria search into dashboard in apps/web/src/app/page.tsx (search panel, apply filters to map + list, match scores, saved searches dropdown)

**Checkpoint**: Define criteria → ranked matches → save "Arlington Distressed" → recall → same results. V2 validated.

---

## Phase 5: User Story 3 — Proactive Pipeline Notifications (Priority: P2)

**Goal**: Webhook receives pipeline events, matches delta against saved criteria, generates summary notifications.
**Independent Test**: POST webhook, verify notification appears linking to matched properties. (V3 in quickstart.md)
**Agent**: `metagross` | **Skills**: `apply-engineering-guidelines`, `build-frontend-backends`
**Contract**: `contracts/webhook-receiver.md`

- [x] T033 [US3] Implement webhook handler service in apps/api/src/services/webhook-handler.ts (verify HMAC-SHA256, deduplicate by event_id in pipeline_events table, load delta parcel_ids, match against all saved criteria with notifications_enabled via server-side DuckDB, generate summary notification per criteria set per run; emit Powertools metrics: WebhookProcessed, WebhookFailed, NotificationGenerated, CriteriaMatched, ProcessingDuration)
- [x] T034 [US3] Create webhook tRPC router in apps/api/src/routers/webhook.ts (POST-style mutation calling webhook-handler; return accepted/duplicate/error per contract)
- [x] T035 [US3] Create notifications tRPC router in apps/api/src/routers/notifications.ts (list with unread count, markAsRead mutation)
- [x] T036 [P] [US3] Create NotificationBell component in apps/web/src/components/notifications/NotificationBell.tsx (header icon with unread badge, dropdown preview)
- [x] T037 [US3] Create NotificationList component in apps/web/src/components/notifications/NotificationList.tsx (history: summary, criteria name, run reference, timestamp, click to navigate)
- [x] T038 [US3] Create notifications page in apps/web/src/app/notifications/page.tsx (full history, filter by criteria set)

**Checkpoint**: POST webhook → notification generated → bell badge → history → click navigates to matches. V3 validated.

---

## Phase 6: User Story 4 — CRM Acquisition Workflow (Priority: P2)

**Goal**: Create opportunities from properties, track stages, record notes/offers, assign tasks, filter.
**Independent Test**: Create opportunity, advance stages, add notes, assign task, filter list. (V4 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `use-elephant-query-db`

- [x] T039 [US4] Create opportunities tRPC router in apps/api/src/routers/opportunities.ts (list with filters: stage, zip, criteria score, distress signals, date range; create from parcel_id populating owner from DuckDB; getById; updateStage with history recording; updateDetails for notes/offers/interest; Zod validation)
- [x] T040 [P] [US4] Create tasks sub-router in apps/api/src/routers/opportunities.ts (list, create with title/assignee/due_date, toggleCompleted)
- [x] T041 [US4] Create OpportunityCard component in apps/web/src/components/opportunities/OpportunityCard.tsx (stage, owner, asking price, offer, match score, last updated)
- [x] T042 [P] [US4] Create StageTracker component in apps/web/src/components/opportunities/StageTracker.tsx (visual pipeline: Identified → Contacted → Negotiating → Under Contract → Closed/Dead; click to advance with note prompt)
- [x] T043 [US4] Create opportunities page in apps/web/src/app/opportunities/page.tsx (filterable list, click card → detail with StageTracker, notes, tasks, offers)
- [x] T044 [US4] Add "Create Opportunity" to PropertyDetail in apps/web/src/components/properties/PropertyDetail.tsx (check existing by parcel_id — warn + link if exists; otherwise create)

**Checkpoint**: Property → Create Opportunity → advance stages → notes/offers → assign task → filter list. V4 validated.

---

## Phase 7: User Story 5 — Mocked Outreach Campaigns (Priority: P3)

**Goal**: Simulated email, SMS, direct mail outreach with lifecycle tracking.
**Independent Test**: Send mocked outreach, verify lifecycle progression. (V5 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`

- [x] T045 [US5] Create outreach tRPC router in apps/api/src/routers/outreach.ts (list by opportunity, create with channel/recipient/subject, simulate lifecycle: sent → delivered → replied/bounced after random delays)
- [x] T046 [US5] Create OutreachPanel component in apps/web/src/components/opportunities/OutreachPanel.tsx (send buttons for email/SMS/direct mail, history table: channel, recipient, status, timestamps)
- [x] T047 [US5] Integrate OutreachPanel into opportunity detail in apps/web/src/app/opportunities/page.tsx

**Checkpoint**: Send mocked email → "Sent" → "Delivered" → "Replied"/"Bounced". V5 validated.

---

## Phase 8: User Story 6 — Natural-Language Agent Queries (Priority: P3)

**Goal**: RAG-backed agent answering property questions with source evidence.
**Independent Test**: Ask NL query, verify relevant properties with sources. (V6 in quickstart.md)
**Agent**: `ash` | **Skills**: `build-ai-agents`

- [x] T048 [US6] Create agent tRPC router in apps/api/src/routers/agent.ts (Vercel AI SDK generateText with @ai-sdk/amazon-bedrock, system prompt with Parquet schema, Zod-defined tools: queryProperties builds SQL + executes via server-side DuckDB, getOpportunityStatus checks CRM state; stream results)
- [x] T049 [US6] Create AgentChat component in apps/web/src/components/agent/AgentChat.tsx (chat input, streaming response, property result cards with provenance, click to navigate)
- [x] T050 [US6] Integrate agent chat into layout in apps/web/src/app/layout.tsx (collapsible panel or /agent page)

**Checkpoint**: Ask "show distressed properties in Arlington with roofs older than 15 years" → matches with sources → click → detail. V6 validated.

---

## Phase 9: User Story 7 — Export and Future Placeholders (Priority: P3)

**Goal**: CSV export, disabled placeholder sections.
**Independent Test**: Export CSV, verify contents. Placeholders visible but disabled. (V7 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`

- [x] T051 [P] [US7] Create export tRPC router in apps/api/src/routers/export.ts (accept parcel_ids or opportunity_ids, query DuckDB/Neon, return CSV)
- [x] T052 [P] [US7] Add export button to PropertyList and opportunities page (apps/web/src/components/properties/PropertyList.tsx, apps/web/src/app/opportunities/page.tsx — select records, export, download)
- [x] T053 [US7] Add disabled placeholder nav items in apps/web/src/app/layout.tsx sidebar (Disposition, Portfolio Tracking, Live Messaging — "Coming Soon" badge, non-clickable)

**Checkpoint**: Filter → select → export → CSV downloads. Sidebar shows disabled future sections. V7 validated.

---

## Phase 10: Infrastructure & Observability

**Purpose**: CDK stack, Powertools, PagerDuty, Amplify config
**Agent**: `metagross` | **Skills**: `apply-engineering-guidelines`, `build-frontend-backends`

- [x] T054 Create CDK stack in apps/api/infra/stack.ts (Lambda with Node.js 22.x runtime, API Gateway v2, custom domain mapping with base path, X-Ray active tracing, Powertools env vars: POWERTOOLS_SERVICE_NAME, POWERTOOLS_METRICS_NAMESPACE, NODE_OPTIONS; resource tagging with project_name; region us-east-2; CORS for Amplify origin)
- [x] T055 Add PagerDuty alerting to webhook handler in apps/api/src/services/webhook-handler.ts (on terminal webhook processing failure: fetch routing key from Secrets Manager, POST to PagerDuty Events API v2; gated to production account only)
- [x] T056 [P] Register CloudWatch metrics in Lexicon — add entries to cloudwatch-metrics.json: WebhookProcessed, WebhookFailed, NotificationGenerated, CriteriaMatched, ProcessingDuration (namespace: ResidentialCRM, dimensions: service, environment)
- [x] T057 [P] Add CloudWatch dashboard widgets for all registered metrics in Main Dashboard repo

**Checkpoint**: CDK deploys Lambda + API Gateway in us-east-2. Powertools logs/traces/metrics visible in CloudWatch. PagerDuty triggers on simulated failure.

---

## Phase 11: Testing & CI/CD

**Purpose**: Vitest tests, GitHub Actions pipeline
**Agent**: `metagross` | **Skills**: `apply-engineering-guidelines`, `integrate-ci-cd`

- [x] T058 [P] Write unit tests for criteria matcher in apps/api/tests/unit/criteria-matcher.test.ts (percentage scoring, per-criterion breakdown, partial matches, zero matches, all-match)
- [x] T059 [P] Write unit tests for webhook handler in apps/api/tests/unit/webhook-handler.test.ts (HMAC verification, event deduplication, delta matching, notification generation; use aws-sdk-client-mock)
- [x] T060 [P] Write contract test for webhook payload in apps/api/tests/contract/webhook-payload.test.ts (validate shape matches contracts/webhook-receiver.md, test accepted/duplicate/unauthorized/error responses)
- [x] T061 Configure GitHub Actions CI pipeline in .github/workflows/ci.yml (pnpm install, turbo run lint, turbo run typecheck, turbo run test, turbo run build)
- [x] T062 Configure GitHub Actions CD pipeline in .github/workflows/deploy.yml (on merge to main: cdk deploy for backend, Amplify auto-deploys frontend)

**Checkpoint**: All tests pass. CI pipeline runs on PR. CD deploys on merge.

---

## Phase 12: Deployment & Validation

**Purpose**: Deploy, validate, demo
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `apply-engineering-guidelines`

- [x] T063 Create amplify.yml in apps/web/ (pnpm install, turbo build --filter=web..., artifacts from .next/)
- [x] T064 Deploy Amplify frontend app with NEXT_PUBLIC_API_URL environment variable per branch — URL: https://feature-003-residential-jax-crm.d2nys96ft16522.amplifyapp.com/
- [x] T065 Deploy CDK backend stack via `cdk deploy` to us-east-2 — API URL: https://42trwtmqqe.execute-api.us-east-2.amazonaws.com/
- [ ] T066 Run full quickstart.md validation (V1-V8) against deployed URLs
- [ ] T067 [P] Validate map performance — load full Duval dataset (~245k properties), verify map interactions under 2 seconds (SC-004)
- [ ] T068 [P] Validate agent accuracy — run 3 demo transcript queries, verify relevant results with sources for at least 80% (SC-005)
- [x] T069 [P] Add staleness warning UI when IPNS resolution fails or data is older than 24h (parent integration spec FR-013: show banner, retry in background)
- [x] T070 [P] Add duplicate opportunity guard in apps/api/src/routers/opportunities.ts (check existing by parcel_id, return warning + link)
- [ ] T071 Record demo video walkthrough covering end-to-end flow from spec demo transcript

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phases 3-4 (US1, US2)**: Both P1. US1 first (map prerequisite for search display), then US2
- **Phases 5-6 (US3, US4)**: Both P2. US3 needs US2 (saved criteria). US4 needs US1. Can run in parallel.
- **Phases 7-9 (US5, US6, US7)**: All P3. US5 needs US4. US6 needs Phase 2 only. US7 needs US1+US4.
- **Phase 10 (Infra)**: After Phase 2, can run in parallel with user stories
- **Phase 11 (Tests)**: After corresponding user story implementations
- **Phase 12 (Deploy)**: After Phases 10-11

### User Story Dependencies

- **US1 (Map)**: After Phase 2
- **US2 (Search)**: After US1
- **US3 (Notifications)**: After US2
- **US4 (CRM)**: After US1
- **US5 (Outreach)**: After US4
- **US6 (Agent)**: After Phase 2 (independent of CRM state)
- **US7 (Export)**: After US1 + US4

### Parallel Opportunities

- T004, T005, T006, T007, T008, T009 (setup) — parallel
- T023, T025 (marker + list components) — parallel
- T036 (notification bell) — parallel with T037
- T040, T042 (task sub-router + stage tracker) — parallel
- T051, T052 (export route + button) — parallel
- T058, T059, T060 (all tests) — parallel
- T067, T068, T069, T070 (validation tasks) — parallel
- US5, US6, US7 can run in parallel once US4 is done
- Phase 10 can run in parallel with user story phases

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Turborepo monorepo)
2. Complete Phase 2: Foundational (DuckDB + Drizzle + tRPC skeleton)
3. Complete Phase 3: User Story 1 (Map Discovery)
4. Complete Phase 10: Infrastructure (CDK stack)
5. **STOP and VALIDATE**: Map renders properties on deployed runtime
6. Deploy to Amplify + Lambda — working map-based property explorer

### Incremental Delivery

1. Setup + Foundational + Infra → foundation deployed
2. US1 (Map) → deploy → property explorer MVP
3. US2 (Search) → deploy → criteria search with saved searches
4. US3 (Notifications) → deploy → proactive pipeline alerts
5. US4 (CRM) → deploy → deal tracking workflow
6. US5+US6+US7 (Outreach, Agent, Export) → deploy → complete product
7. Tests + CI/CD → quality gates
8. Polish + Demo → final delivery

### Agent Handoff Sequence

1. `donphan` explores property data schema (before Phase 2)
2. `metagross` scaffolds monorepo (Phase 1-2)
3. `metagross` builds tRPC routers, frontend, CDK infra (Phases 3-7, 9-10)
4. `ash` builds RAG agent (Phase 8)
5. `metagross` handles tests, CI/CD, deployment (Phases 11-12)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All tRPC routers use Zod input validation
- Powertools Logger/Tracer/Metrics initialized in tRPC context, available to all procedures
- All frontend API calls go through packages/api-client tRPC client
- Never duplicate types — shared types live in packages/shared
- Commit after each task or logical group
