# Feature Specification: Oracle Pipeline — Duval County

**Feature Branch**: `feature/001-oracle-crm-integration`

**Created**: 2026-08-20

**Status**: In Progress

**Input**: Parent roadmap: `specs/001-oracle-crm-integration/roadmap.md` → entry **R1**. Complete the Oracle pipeline by continuously and incrementally ingesting all available Duval County property, permit, ownership, business, contractor, location, and public-source data, reconciling duplicates, preserving source provenance, publishing full-snapshot artifacts with delta metadata to Elephant IPFS with stable IPNS pointers, sending webhook events to notify consumers, and maintaining a visible pipeline run history UI for the Oracle Operator.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuous Incremental Ingestion (Priority: P1)

The Oracle Operator initiates a pipeline run that ingests property, permit, ownership, business, contractor, and location/coordinate records from Duval County public data sources. The pipeline detects new and changed records since the last run, loads them into the local database, reconciles duplicate entities across sources, and preserves source provenance for every record. Each step is idempotent so the operator can safely re-run without data corruption.

**Why this priority**: This is the foundational capability. Without ingested, reconciled data, nothing else in the system works — no publishing, no queries, no UI.

**Independent Test**: Run the pipeline twice with an interval between runs. Verify the second run ingests only new/changed records, record counts and deltas are accurate, duplicates are reconciled, and provenance is preserved.

**Acceptance Scenarios**:

1. **Given** available Duval County public data sources, **When** the operator triggers a pipeline run, **Then** the pipeline ingests property, permit, ownership, business, contractor, and location/coordinate records into the local database with source provenance.
2. **Given** a previous pipeline run has completed, **When** the operator triggers a new run, **Then** only new and changed records since the last run are ingested (incremental), and the run completes without duplicating existing records.
3. **Given** records from multiple sources refer to the same property, **When** the pipeline reconciles them, **Then** a single unified property record is produced with provenance showing all contributing sources.
4. **Given** a pipeline run is interrupted or fails midway, **When** the operator re-runs the pipeline, **Then** it resumes or restarts idempotently without data loss or corruption.

---

### User Story 2 - Publish to Elephant IPFS with Webhook Signaling (Priority: P2)

After a successful pipeline run, the system publishes a full-snapshot artifact (containing all reconciled records plus delta metadata identifying new/updated/removed records) to Elephant IPFS with a content-addressed CID and updates the stable IPNS pointer. It then sends a webhook event to registered consumers (the CRM) with the IPNS pointer and run identifier.

**Why this priority**: Publishing is the integration contract with the CRM (R2). Without published artifacts and webhook signaling, the CRM cannot consume pipeline data.

**Independent Test**: Complete a pipeline run, verify a new CID is created on Elephant IPFS, the IPNS pointer is updated, and a webhook event is delivered to a test endpoint containing the run identifier and IPNS pointer.

**Acceptance Scenarios**:

1. **Given** a pipeline run has completed successfully, **When** the system publishes, **Then** a full-snapshot artifact is created on Elephant IPFS with a new content-addressed CID following Elephant/Lexicon conventions.
2. **Given** a new artifact is published, **When** the IPNS pointer is updated, **Then** it resolves to the new CID and the previous CID remains accessible for historical reference.
3. **Given** the artifact is published, **When** the system checks its contents, **Then** it contains all reconciled property records, run metadata (timestamp, source list, record counts), and delta metadata (new/updated/removed records since previous run).
4. **Given** publishing is complete, **When** the system sends the webhook event, **Then** the event payload includes the IPNS pointer, run identifier, and a summary of the delta (counts of new/updated/removed records).
5. **Given** the webhook endpoint is unreachable, **When** the system attempts to send, **Then** it retries with backoff and logs the failure without blocking the pipeline run from being considered successful.

---

### User Story 3 - Pipeline Run History and Data Explorer UI (Priority: P3)

The Oracle Operator opens the pipeline UI and sees a chronological history of all pipeline runs with timestamps, source lists, record counts, deltas, and any documented source limitations (slow sites, unavailable sources). The operator can also explore the uploaded data — browsing records by source, viewing provenance, and inspecting the published Elephant IPFS artifacts (CIDs/IPNS pointers).

**Why this priority**: The operator needs visibility into pipeline health and data quality. This is also a demo requirement — the presenter must show run history and data exploration through the UI.

**Independent Test**: After multiple pipeline runs, open the UI and verify run history is visible with accurate counts and deltas, data can be browsed by source, and published IPFS artifacts are displayed.

**Acceptance Scenarios**:

1. **Given** multiple pipeline runs have completed, **When** the operator views run history, **Then** each run shows timestamp, sources ingested, total record count, delta (new/updated/removed), and any source limitations encountered.
2. **Given** the operator is browsing data, **When** they select a property record, **Then** they see all attributes, contributing sources, provenance metadata, and the pipeline run that last updated it.
3. **Given** artifacts have been published to Elephant IPFS, **When** the operator views the artifacts section, **Then** they see the CIDs and IPNS pointers for each published artifact, confirming they follow Elephant conventions.
4. **Given** the operator is viewing run history, **When** a source was slow or unavailable during a run, **Then** that limitation is documented in the run record.

---

### User Story 4 - Property Intelligence Queries (Priority: P4)

The Oracle Operator (or any authorized user) queries the data through the UI and through a natural-language agent to answer property intelligence questions. The system supports specific query types required by stakeholders: properties with roofs older than 15 years, properties with a view of water, properties that have not exchanged ownership in more than 10 years, properties with regional owners, properties within walking distance of public transportation, and properties within walking distance of Starbucks. All answers include source-backed evidence.

**Why this priority**: Queries are the primary value delivery — they prove the data is usable and demonstrate the intelligence layer. Depends on ingestion (US1) being in place.

**Independent Test**: With ingested data loaded, run each of the 6 required query types through both the UI and the agent, and verify results include matching properties with source provenance.

**Acceptance Scenarios**:

1. **Given** property and permit data is loaded, **When** a user searches for properties with roofs older than 15 years, **Then** the system returns matching properties with permit or property evidence and source provenance.
2. **Given** location and parcel data is loaded, **When** a user searches for properties with a view of water, **Then** the system returns properties identified using geographic indicators and explains the source basis for the determination.
3. **Given** ownership history is loaded, **When** a user searches for properties that have not exchanged ownership in more than 10 years, **Then** the system returns properties with ownership records showing no transfer within the last 10 years.
4. **Given** owner metadata is loaded, **When** a user searches for properties with regional owners, **Then** the system returns properties where ownership metadata indicates a regional (non-local) owner.
5. **Given** property coordinates are loaded, **When** a user searches for properties within walking distance of public transportation, **Then** the system returns properties with coordinate-based distance calculations and shows the distance basis.
6. **Given** property coordinates are loaded, **When** a user searches for properties within walking distance of Starbucks, **Then** the system returns properties near Starbucks locations using nearby place data and shows the distance calculation.
7. **Given** a user asks the agent "Which properties have roofs older than 15 years and have not exchanged ownership in more than 10 years?", **When** the agent processes the query, **Then** it returns matching properties with source-backed evidence and reasoning.
8. **Given** the agent cannot fully answer a question due to missing data, **When** it responds, **Then** it identifies available data, missing data, and assumptions made.

---

### User Story 5 - MCP-Ready Access (Priority: P5)

The system exposes the data through an MCP-compatible interface that can resolve published Elephant IPFS/IPNS artifacts. External tools and agents can discover and query the dataset without requiring Oracle-hosted infrastructure.

**Why this priority**: MCP readiness is a stakeholder requirement that proves the infrastructure approach is extensible beyond the immediate UI and agent. Depends on publishing (US2) being complete.

**Independent Test**: Using an MCP client, connect to the system, resolve the published IPNS artifacts, and execute a structured query against the data.

**Acceptance Scenarios**:

1. **Given** data has been published to Elephant IPFS, **When** an MCP client connects, **Then** it can discover the available dataset artifacts via their IPNS pointers.
2. **Given** an MCP client has resolved the artifacts, **When** it issues a structured query, **Then** it receives results without requiring any Oracle-hosted database.

---

### User Story 6 - Acceptance Validation & Demo Recording (Priority: P6)

As a validator, I want to collect proof that the system works by running automated Playwright tests that exercise the acceptance criteria of all implemented user stories, recording video evidence of each test as demo artifacts.

**Why this priority**: This is the final validation gate. Tests prove all user stories work against the deployed runtime. Recorded videos serve as the demo artifact for stakeholder review.

**Independent Test**: Run the Playwright test suite against the deployed frontend. All tests pass. Videos are saved as demo artifacts.

**Acceptance Scenarios**:

1. **Given** the deployed frontend is accessible, **When** the Dashboard page loads, **Then** it displays stat cards (Total Properties > 0, Last Run with timestamp, Sources count), a Records by Source table with entries, and IPFS/MCP status section showing the IPNS pointer.
2. **Given** pipeline runs have completed, **When** the Pipeline Runs page loads, **Then** it shows a chronological table of runs with status badges, and the Trigger Run button is visible.
3. **Given** the Trigger Run button is clicked, **When** the pipeline run completes, **Then** the runs table updates with a new entry showing status "Success" and non-zero delta counts.
4. **Given** property data is loaded, **When** each of the 6 query types is selected on the Property Search page, **Then** results appear in the table with parcel IDs, addresses, values, and adaptive signal columns.
5. **Given** the Agent Chat page is open, **When** the user sends "How many properties are in the database?", **Then** the agent responds with a count and source provenance within 30 seconds.
6. **Given** the Agent Chat page is open, **When** the user sends "Which properties have roofs older than 15 years?", **Then** the agent responds with matching properties and cites source data.
7. **Given** all tests pass, **When** the test suite completes, **Then** video recordings exist for each test as demo artifacts in the `e2e/videos/` directory.

---

### Edge Cases

- **Source unavailability**: When a Duval County data source is temporarily unavailable during a pipeline run, the pipeline completes with the available sources and documents the limitation in the run record.
- **Partial ingestion failure**: When ingestion fails for one source mid-run, records from successfully ingested sources are preserved; the failed source is retried on the next run.
- **Elephant IPFS publish failure**: When publishing to IPFS fails after successful ingestion, the data remains in the local database and the operator is notified; the publish step can be retried independently.
- **Webhook delivery failure**: When the webhook endpoint is unreachable, the pipeline retries with backoff and logs the failure; the pipeline run is still considered successful (data is published, notification is best-effort).
- **Reconciliation ambiguity**: When the pipeline cannot confidently determine whether two records from different sources refer to the same property, it preserves both records separately with their respective provenance rather than risking an incorrect merge.
- **Walking distance calculation**: When property coordinates or place data (transit stops, Starbucks locations) are unavailable for certain properties, the query result excludes those properties and notes the data gap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST ingest property, permit, ownership, business, contractor, and location/coordinate records from Duval County public data sources.
- **FR-002**: The pipeline MUST support continuous/incremental ingestion — detecting and loading only new and changed records on each run.
- **FR-003**: Each pipeline step MUST be idempotent so that re-runs do not corrupt or duplicate data.
- **FR-004**: The pipeline MUST reconcile duplicate entities across all ingested sources using available matching signals (parcel ID, address, owner name).
- **FR-005**: The pipeline MUST preserve source provenance for every record — identifying which source(s) contributed each data point and when it was collected.
- **FR-006**: The pipeline MUST maintain a visible history of all runs including timestamp, source list, record counts, deltas (new/updated/removed), and any source limitations.
- **FR-007**: After each successful run, the pipeline MUST publish a full-snapshot artifact with delta metadata to Elephant IPFS with a content-addressed CID following Elephant/Lexicon conventions.
- **FR-008**: The pipeline MUST update a stable IPNS pointer to reference the latest published artifact CID.
- **FR-009**: After publishing, the pipeline MUST send a webhook event to registered consumers containing the IPNS pointer, run identifier, and delta summary.
- **FR-010**: The pipeline MUST provide a UI for browsing run history, exploring uploaded data by source, viewing provenance, and inspecting published IPFS artifacts.
- **FR-011**: The system MUST support property intelligence queries through the UI: roof age > 15 years, water view, ownership tenure > 10 years, regional owners, walking distance to public transit, walking distance to Starbucks.
- **FR-012**: The system MUST support property intelligence queries through a natural-language agent with source-backed answers.
- **FR-013**: The system MUST expose data through an MCP-compatible interface that resolves published Elephant IPFS/IPNS artifacts.
- **FR-014**: The system MUST operate without Oracle-hosted database infrastructure costs — using local/portable storage and Elephant IPFS.
- **FR-015**: The pipeline MUST optimize performance where feasible and document slow or constrained data sources.

### Key Entities

- **Pipeline Run**: A single execution of the ingestion pipeline; carries timestamp, source list, record counts, delta summary, source limitations, and status (success/partial/failed). Produces a published artifact upon success.
- **Data Source**: A Duval County public data source providing one category of records (property, permit, ownership, business, contractor, or location). Each source has a known URL/endpoint, a collection method, and documented limitations.
- **Property Record**: A reconciled entity representing a Duval County property; attributes include parcel ID/RE#, address, assessed value, ownership history, permit history, coordinates, and any derived signals (roof age, water proximity). Carries provenance metadata listing contributing sources and timestamps.
- **Published Artifact**: A content-addressed data package on Elephant IPFS; contains the full snapshot of all reconciled records, run metadata, and delta metadata. Referenced by a stable IPNS pointer.
- **Webhook Event**: A push notification sent to registered consumers after artifact publication; payload includes IPNS pointer, run identifier, and delta summary (counts of new/updated/removed records).
- **Source Provenance**: Metadata attached to every record field identifying which data source contributed the value and when it was collected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The pipeline demonstrates at least 2 distinct runs with visible deltas showing incremental ingestion of real Duval County data.
- **SC-002**: 100% of records in the database include source provenance identifying contributing source(s) and collection timestamp.
- **SC-003**: All 6 required property intelligence query types return results with source-backed evidence through both UI and agent.
- **SC-004**: Published Elephant IPFS artifacts are resolvable via their IPNS pointers and follow Elephant/Lexicon conventions.
- **SC-005**: The system operates with zero Oracle-hosted database cost — all querying uses the local/portable engine and published IPFS artifacts.
- **SC-006**: Pipeline run history is visible in the UI showing timestamps, source lists, record counts, and deltas for every completed run.
- **SC-007**: The natural-language agent answers multi-attribute property queries with source-backed evidence in under 10 seconds.
- **SC-008**: Webhook events are delivered to registered consumers within 30 seconds of artifact publication.

## Assumptions

- Duval County public data sources are accessible via their existing public interfaces (web portals, open data APIs) without requiring paid subscriptions or special access agreements.
- The candidate acts as both Oracle operator and builder — a single person responsible for pipeline development and operation.
- Court data enrichment (foreclosure, lien, probate, code enforcement) is optional and not required for this milestone. If included, it is an additive data source that does not change the pipeline contract.
- Schema versioning for published artifacts is deferred — the CRM assumes a stable schema for the initial milestone.
- "Walking distance" is defined as within 0.5 miles (approximately 10-minute walk) for proximity queries, using straight-line distance from property coordinates.
- Water view determination uses available geographic and parcel data (waterfront flags, proximity to water bodies from GIS data) rather than visual inspection.
- Regional owners are identified by comparing owner mailing address to the property's county/state — owners with addresses outside Duval County or Florida are considered regional.
- Starbucks and public transit stop locations are sourced from publicly available place datasets or APIs.
- The pipeline is designed for analytical workloads (batch ingestion, periodic queries), not real-time transactional processing.
