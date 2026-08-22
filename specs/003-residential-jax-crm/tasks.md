# Tasks: Residential Property Acquisition CRM

**Input**: Design documents from `specs/003-residential-jax-crm/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/webhook-receiver.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted. Add via `/speckit-tasks --tdd` if needed.

**Organization**: Tasks grouped by user story for independent implementation. Agent/skill references from plan.md Agent & Skill Mapping.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and tooling
**Agent**: `metagross` | **Skills**: `apply-engineering-guidelines`, `build-frontend-backends`

- [ ] T001 Initialize Next.js 14+ App Router project with TypeScript in repository root
- [ ] T002 Install core dependencies: maplibre-gl, react-map-gl, @duckdb/duckdb-wasm, drizzle-orm, @neondatabase/serverless, ai (Vercel AI SDK)
- [ ] T003 [P] Configure Vitest with TypeScript support in vitest.config.ts
- [ ] T004 [P] Configure ESLint + Prettier in .eslintrc.json and .prettierrc
- [ ] T005 [P] Create .env.example with DATABASE_URL, WEBHOOK_SECRET, NEXT_PUBLIC_IPNS_OPEN_DATA, NEXT_PUBLIC_IPNS_QUERY_TABLE, OPENAI_API_KEY
- [ ] T006 Create shared TypeScript types for property data in src/types/property.ts (Property, Owner, Provenance, DerivedSignals from data-model.md)
- [ ] T007 [P] Create shared TypeScript types for CRM entities in src/types/crm.ts (Opportunity, OutreachRecord, Task, SavedCriteria, Notification)
- [ ] T008 [P] Create shared TypeScript types for pipeline integration in src/types/pipeline.ts (WebhookEvent, PipelineRun, DeltaSummary)

**Checkpoint**: Project builds, lints, and runs `next dev` with empty pages.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data access layers that ALL user stories depend on
**Agent**: `metagross` | **Skills**: `use-elephant-query-db`, `use-elephant-mcp`, `build-frontend-backends`

**Data exploration prerequisite**: Use `donphan` agent with `use-elephant-mcp` skill to verify Duval property Parquet schema fields match data-model.md before building queries.

- [ ] T009 Implement DuckDB-WASM initialization and Parquet loading from IPFS in src/lib/duckdb.ts (httpfs extension, IPNS URL resolution, CREATE VIEW for properties)
- [ ] T010 Implement IPNS resolution helper in src/lib/ipfs.ts (resolve IPNS pointer to CID, construct Filebase gateway URLs for open-data and query-table labels)
- [ ] T011 Define Drizzle ORM schema for all CRM tables in src/lib/db/schema.ts (saved_criteria, pipeline_events, notifications, opportunities, opportunity_history, tasks, outreach_records — per data-model.md)
- [ ] T012 Create Drizzle client with Neon serverless driver in src/lib/db/index.ts
- [ ] T013 Create drizzle.config.ts and run initial migration to Neon with `drizzle-kit push`
- [ ] T014 Create root layout with sidebar navigation in src/app/layout.tsx (links: Map/Dashboard, Opportunities, Notifications)

**Checkpoint**: DuckDB-WASM loads Duval Parquet from IPFS, Drizzle connects to Neon, layout renders with navigation.

---

## Phase 3: User Story 1 — Map-Based Property Discovery (Priority: P1) MVP

**Goal**: Interactive map centered on Jacksonville/Duval County showing ~245k residential properties with detail panel and list view.
**Independent Test**: Open the CRM, verify properties render on map, click a marker to see detail, switch to list view. (V1 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `use-elephant-mcp`

- [ ] T015 [US1] Create PropertyMap component with MapLibre GL JS in src/components/map/PropertyMap.tsx (center on Jacksonville 30.3322/-81.6557, zoom 11, GeoJSON source with cluster layer for ~245k properties)
- [ ] T016 [P] [US1] Create PropertyMarker component in src/components/map/PropertyMarker.tsx (popup on click showing parcel ID, address, assessed value)
- [ ] T017 [US1] Implement property data loading hook in src/lib/duckdb.ts — add `queryProperties()` function that runs SELECT on DuckDB view and returns GeoJSON FeatureCollection for map
- [ ] T018 [US1] Create PropertyDetail panel component in src/components/properties/PropertyDetail.tsx (parcel ID, address, owner, assessed value, ownership tenure, roof age, coordinates, provenance with source list, pipeline run, collection timestamps)
- [ ] T019 [P] [US1] Create PropertyList component in src/components/properties/PropertyList.tsx (sortable table with columns: parcel ID, address, owner, assessed value, tenure years, roof age; click row to select on map)
- [ ] T020 [US1] Create main dashboard page in src/app/page.tsx (split layout: map left, list/detail right; synchronized selection between map and list; toggle between map-only, list-only, split views)

**Checkpoint**: Map displays Duval County properties with clustering. Click a marker → detail panel. Switch to list → same data in sortable table. V1 validated.

---

## Phase 4: User Story 2 — Criteria Search and Saved Searches (Priority: P1)

**Goal**: Define, apply, and save acquisition criteria with percentage match scoring and geographic filtering.
**Independent Test**: Define criteria, verify matches appear ranked, save as named search, recall it. (V2 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `use-elephant-mcp`

- [ ] T021 [US2] Implement criteria matcher logic in src/lib/criteria-matcher.ts (evaluate property against filter set, return percentage score + per-criterion breakdown; filters: ownership_tenure_min_years, roof_age_min_years, zip_codes, assessed_value_min/max, is_regional_owner, water_proximity_max_ft)
- [ ] T022 [US2] Create SearchCriteria form component in src/components/properties/SearchCriteria.tsx (input fields for each filter type, apply button, clear button, save button)
- [ ] T023 [US2] Create DrawControl component in src/components/map/DrawControl.tsx (MapLibre draw plugin for polygon and radius geographic bounds, emit GeoJSON to parent)
- [ ] T024 [US2] Add DuckDB query functions for criteria filtering in src/lib/duckdb.ts — `queryPropertiesByCriteria(filters)` that builds WHERE clause from filter set and returns matched properties with match scores
- [ ] T025 [US2] Create API route for saved criteria CRUD in src/app/api/criteria/route.ts (GET list, POST create — persist to saved_criteria table via Drizzle)
- [ ] T026 [US2] Create API route for individual criteria in src/app/api/criteria/[id]/route.ts (GET, PUT, DELETE)
- [ ] T027 [US2] Integrate criteria search into dashboard page src/app/page.tsx (search panel, apply filters to map + list, show match scores, saved searches dropdown to recall)

**Checkpoint**: Define criteria → properties ranked by percentage match → save as "Arlington Distressed" → recall → same results. V2 validated.

---

## Phase 5: User Story 3 — Proactive Pipeline Notifications (Priority: P2)

**Goal**: Webhook receives pipeline events, matches delta records against saved criteria, generates summary notifications.
**Independent Test**: Simulate webhook POST, verify notification appears linking to matched properties. (V3 in quickstart.md)
**Agent**: `metagross` | **Skills**: `apply-engineering-guidelines`, `build-frontend-backends`
**Contract**: `contracts/webhook-receiver.md`

- [ ] T028 [US3] Implement webhook handler in src/lib/webhook-handler.ts (verify HMAC-SHA256 signature, deduplicate by event_id, store in pipeline_events table, process delta — match new/updated parcel_ids against all saved criteria with notifications_enabled, generate summary notifications per criteria set per run)
- [ ] T029 [US3] Create webhook API route in src/app/api/webhook/pipeline/route.ts (POST handler calling webhook-handler, return 200 accepted/duplicate or 401/500 per contract)
- [ ] T030 [P] [US3] Create API route for notifications in src/app/api/notifications/route.ts (GET list with unread count, PATCH mark as read)
- [ ] T031 [P] [US3] Create NotificationBell component in src/components/notifications/NotificationBell.tsx (header icon with unread badge, dropdown preview of recent notifications)
- [ ] T032 [US3] Create NotificationList component in src/components/notifications/NotificationList.tsx (full history: summary text, matched criteria name, pipeline run reference, timestamp, click to navigate to matched properties)
- [ ] T033 [US3] Create notifications page in src/app/notifications/page.tsx (full notification history with NotificationList, filter by criteria set, link to property batch)

**Checkpoint**: POST webhook → notification generated → bell shows badge → click opens history → click notification navigates to matched properties. V3 validated.

---

## Phase 6: User Story 4 — CRM Acquisition Workflow (Priority: P2)

**Goal**: Create opportunities from properties, track through stages, record notes/offers, assign tasks, filter by multiple dimensions.
**Independent Test**: Create opportunity from property, advance stages, add notes, assign task, filter list. (V4 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`, `use-elephant-query-db`

- [ ] T034 [US4] Create API routes for opportunities in src/app/api/opportunities/route.ts (GET list with filters — stage, zip, criteria score; POST create from parcel_id — populate owner_name from DuckDB, set stage=identified, link source_criteria_id)
- [ ] T035 [US4] Create API route for individual opportunity in src/app/api/opportunities/[id]/route.ts (GET detail, PATCH update stage/notes/offers/interest, record history in opportunity_history)
- [ ] T036 [P] [US4] Create API routes for tasks in src/app/api/opportunities/[id]/tasks/route.ts (GET list, POST create with title, assignee, due_date; PATCH toggle completed)
- [ ] T037 [US4] Create OpportunityCard component in src/components/opportunities/OpportunityCard.tsx (show stage, owner, asking price, offer, match score, last updated)
- [ ] T038 [P] [US4] Create StageTracker component in src/components/opportunities/StageTracker.tsx (visual pipeline: Identified → Contacted → Negotiating → Under Contract → Closed/Dead; click to advance with note prompt)
- [ ] T039 [US4] Create opportunities page in src/app/opportunities/page.tsx (filterable list: by stage, zip code, criteria match score, distress signals (ownership tenure, roof age, regional owner), date range; click card → detail view with StageTracker, notes, tasks, offers)
- [ ] T040 [US4] Add "Create Opportunity" button to PropertyDetail component in src/components/properties/PropertyDetail.tsx (check for existing opportunity on same parcel_id — warn if exists, link to it; otherwise create new)

**Checkpoint**: Property detail → Create Opportunity → advance stages → record notes/offers → assign task → filter in opportunity list. V4 validated.

---

## Phase 7: User Story 5 — Mocked Outreach Campaigns (Priority: P3)

**Goal**: Simulated email, SMS, and direct mail outreach with lifecycle tracking.
**Independent Test**: Send mocked outreach, verify lifecycle progression appears in history. (V5 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`

- [ ] T041 [US5] Create API routes for outreach in src/app/api/opportunities/[id]/outreach/route.ts (GET list, POST create with channel + recipient + subject; auto-simulate lifecycle progression via setTimeout or cron: sent → delivered → replied/bounced after random delays)
- [ ] T042 [US5] Create OutreachPanel component in src/components/opportunities/OutreachPanel.tsx (send buttons for email/SMS/direct mail, outreach history table: channel, recipient, status, timestamps)
- [ ] T043 [US5] Integrate OutreachPanel into opportunity detail view in src/app/opportunities/page.tsx (tab or section within opportunity detail showing outreach history + send actions)

**Checkpoint**: Select opportunity → send mocked email → status shows "Sent" → progresses to "Delivered" → eventually "Replied" or "Bounced". V5 validated.

---

## Phase 8: User Story 6 — Natural-Language Agent Queries (Priority: P3)

**Goal**: RAG-backed agent that answers property questions in natural language with source-backed evidence.
**Independent Test**: Ask NL query, verify relevant properties returned with sources. (V6 in quickstart.md)
**Agent**: `ash` | **Skills**: `build-ai-agents`, `build-local-rag-pocs`

- [ ] T044 [US6] Implement agent API route with Vercel AI SDK in src/app/api/agent/route.ts (system prompt with Parquet schema and available columns, tool definition for `queryProperties` that builds SQL from NL and executes via server-side DuckDB, tool for `getOpportunityStatus` to check CRM state)
- [ ] T045 [US6] Create AgentChat component in src/components/agent/AgentChat.tsx (chat input, streaming response display, property result cards with match rationale and provenance, click result to navigate to property detail)
- [ ] T046 [US6] Integrate agent chat into the main layout in src/app/layout.tsx (collapsible chat panel accessible from any page, or dedicated /agent page)

**Checkpoint**: Ask "show distressed properties in Arlington with roofs older than 15 years" → agent returns matches with sources → click result → property detail. V6 validated.

---

## Phase 9: User Story 7 — Export and Future Placeholders (Priority: P3)

**Goal**: CSV export of selected records, disabled placeholder sections for future features.
**Independent Test**: Select records, export CSV, verify file contents. Placeholder sections visible but disabled. (V7 in quickstart.md)
**Agent**: `metagross` | **Skills**: `build-frontend-backends`

- [ ] T047 [P] [US7] Create export API route in src/app/api/export/route.ts (POST with array of parcel_ids or opportunity_ids, query DuckDB/Neon, return CSV with all attributes)
- [ ] T048 [P] [US7] Add export button to property list and opportunity list (src/components/properties/PropertyList.tsx, src/app/opportunities/page.tsx — select records, click Export, trigger download)
- [ ] T049 [US7] Add disabled placeholder navigation items in src/app/layout.tsx sidebar (Disposition, Portfolio Tracking, Live Messaging — visible with "Coming Soon" badge, non-clickable)

**Checkpoint**: Filter opportunities → select → export → CSV downloads with complete data. Sidebar shows disabled future sections. V7 validated.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Deployment, demo, and quality assurance
**Agent**: `metagross` | **Skills**: `apply-engineering-guidelines`, `integrate-ci-cd`

### Tests (constitution: Vitest mandatory)

- [ ] T050 [P] Write unit tests for criteria matcher in tests/unit/criteria-matcher.test.ts (percentage scoring, per-criterion breakdown, partial matches, zero matches, all-match edge case)
- [ ] T051 [P] Write unit tests for webhook handler in tests/unit/webhook-handler.test.ts (HMAC verification, event deduplication, delta matching against saved criteria, summary notification generation)
- [ ] T052 [P] Write contract test for webhook payload in tests/contract/webhook-payload.test.ts (validate incoming payload shape matches contracts/webhook-receiver.md, test 200/401/500 responses)

### Deployment & Validation

- [ ] T053 Configure Vercel deployment with environment variables (DATABASE_URL, WEBHOOK_SECRET, IPNS keys, OPENAI_API_KEY) in vercel.json or Vercel dashboard
- [ ] T054 Deploy to Vercel and verify hosted runtime works without local setup
- [ ] T055 Run full quickstart.md validation (V1-V8) against deployed URL
- [ ] T056 [P] Validate map performance at scale — load full Duval dataset (~245k properties), verify map interactions remain under 2 seconds (SC-004)
- [ ] T057 [P] Validate agent accuracy — run the 3 demo transcript queries against the deployed agent, verify relevant results with sources for at least 80% (SC-005)
- [ ] T058 [P] Add staleness warning UI when IPNS resolution fails or data is older than 24h (parent integration spec FR-013 — graceful IPNS degradation: show banner, retry in background)
- [ ] T059 [P] Add duplicate opportunity guard in src/app/api/opportunities/route.ts (check existing opportunity for same parcel_id before creating, return warning + link)
- [ ] T060 [P] Configure GitHub Actions CI/CD pipeline with Vitest test runner and Vercel deploy (integrate-ci-cd skill)
- [ ] T061 Record demo video walkthrough covering the end-to-end flow from spec demo transcript

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phases 3-4 (US1, US2)**: Both P1 priority. US1 first (map is prerequisite for search display), then US2
- **Phases 5-6 (US3, US4)**: Both P2 priority. Can run in parallel after US1+US2, or sequentially
- **Phases 7-9 (US5, US6, US7)**: All P3. Can run in parallel after US4 (outreach needs opportunities)
- **Phase 10 (Polish)**: After all desired stories complete

### User Story Dependencies

- **US1 (Map Discovery)**: After Phase 2 — no dependencies on other stories
- **US2 (Criteria Search)**: After US1 — needs map + property data loading working
- **US3 (Notifications)**: After US2 — needs saved criteria to match against
- **US4 (CRM Workflow)**: After US1 — needs property data and detail panel
- **US5 (Outreach)**: After US4 — needs opportunity records to attach outreach
- **US6 (Agent)**: After Phase 2 — only needs DuckDB data layer, independent of CRM state
- **US7 (Export)**: After US1 + US4 — needs both property data and opportunities

### Within Each Story

- Types/models before services
- Services before API routes
- API routes before UI components
- Components before page integration

### Parallel Opportunities

- T003, T004, T005 (setup config) — parallel
- T006, T007, T008 (types) — parallel
- T016, T019 (marker + list components) — parallel
- T030, T031 (notification API + bell) — parallel
- T036, T038 (task API + stage tracker) — parallel
- T047, T048, T049 (export tasks) — parallel
- T053, T054 (polish tasks) — parallel
- US5, US6, US7 can run in parallel once US4 is done

---

## Parallel Example: User Story 1

```bash
# After Phase 2, launch US1 components in parallel:
Task: "Create PropertyMarker component in src/components/map/PropertyMarker.tsx"
Task: "Create PropertyList component in src/components/properties/PropertyList.tsx"

# Then sequentially:
Task: "Create PropertyMap with cluster layer"
Task: "Create PropertyDetail panel"
Task: "Create main dashboard page integrating all"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Map Discovery)
4. **STOP and VALIDATE**: Map renders properties, click detail, list view works
5. Deploy to Vercel — working map-based property explorer

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 (Map) → deploy → property explorer MVP
3. US2 (Search) → deploy → criteria-based search with saved searches
4. US3 (Notifications) → deploy → proactive alerts on pipeline updates
5. US4 (CRM) → deploy → full deal tracking workflow
6. US5+US6+US7 (Outreach, Agent, Export) → deploy → complete product
7. Polish → final demo

### Agent Handoff Sequence

1. `metagross` scaffolds project (Phase 1-2)
2. `donphan` explores property data schema (before Phase 3)
3. `metagross` builds map, search, CRM, webhook (Phases 3-7, 9)
4. `ash` builds RAG agent (Phase 8)
5. `metagross` handles deployment + polish (Phase 10)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Agent/skill references are from plan.md Agent & Skill Mapping section
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No test tasks generated — add via `/speckit-tasks --tdd` if needed
