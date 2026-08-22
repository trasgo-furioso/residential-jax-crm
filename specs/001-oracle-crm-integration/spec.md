# Feature Specification: Oracle-CRM Integration Contract

**Feature Branch**: `feature/001-oracle-crm-integration`

**Created**: 2026-08-20

**Status**: Planning

**Input**: Parent integration spec defining the contract between the Oracle Property Intelligence Pipeline and the Residential Acquisition CRM. Each system will have its own spec-of-specs; this spec governs the integration user journeys and the data contract between them.

**Parent PRD**: `specs/001-oracle-crm-integration/prd.md`

**Sub-specs** (to be created):
- Oracle Pipeline: `oracle-property-intelligence-platform-pipeline-duval-fl/` — owns data ingestion, reconciliation, and IPFS publishing
- Residential CRM: `residential-jax-crm/` — owns search, criteria matching, notifications, and acquisition workflow

## Clarifications

### Session 2026-08-20

- Q: How should the CRM detect new pipeline artifacts — polling or push? → A: Pipeline sends events to a CRM webhook after publishing.
- Q: Does the pipeline publish the full dataset or only deltas? → A: Full snapshot as primary artifact, with delta metadata included for efficient CRM processing (per stakeholder: "re-publish updated artifacts" + "record deltas and timestamps").
- Q: When IPNS resolution fails, should CRM block or degrade gracefully? → A: Continue with last loaded data, retry in background, surface staleness warning.
- Q: When multiple pipeline runs publish rapidly, should CRM process every artifact or skip to latest? → A: Process every artifact sequentially to guarantee per-run notification granularity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pipeline Publishes, CRM Discovers (Priority: P1)

The Oracle Operator completes a pipeline run that ingests new or changed Duval County property records. The pipeline reconciles duplicates, produces a versioned data artifact (full snapshot with delta metadata), and publishes it to Elephant IPFS with a stable IPNS pointer. The pipeline then sends a webhook event to the CRM. The CRM resolves the new artifact and makes the updated records available for search and criteria matching — all without a hosted database.

**Why this priority**: This is the foundational integration path. Without the pipeline publishing and the CRM consuming, nothing else works. It also proves the zero-Oracle-hosted-cost architecture.

**Independent Test**: Run a pipeline ingestion cycle, verify the artifact is published to IPFS with a new CID under a stable IPNS name, then confirm the CRM resolves the updated pointer and surfaces the new/changed records in search results.

**Acceptance Scenarios**:

1. **Given** the pipeline has completed an incremental ingestion run with new records, **When** the pipeline publishes the updated artifact to Elephant IPFS, **Then** the published artifact has a new CID and the IPNS pointer is updated to reference it.
2. **Given** the pipeline has published and sent a webhook event to the CRM, **When** the CRM receives the event, **Then** it resolves the new CID from the IPNS pointer, loads the updated records, and they appear in search results.
3. **Given** the pipeline has reconciled duplicate entities across sources, **When** the CRM loads the artifact, **Then** it receives deduplicated records with clear provenance attribution per source.
4. **Given** the CRM is operating, **When** no hosted Oracle database is available, **Then** the CRM still functions by resolving data exclusively from Elephant IPFS via IPNS pointers and querying locally.

---

### User Story 2 - Proactive Notification on Pipeline Update (Priority: P2)

A CRM User has saved acquisition criteria (e.g., roof age > 15 years, no ownership change in 10+ years, within specific neighborhoods). When the pipeline publishes an update containing new or changed records that match those saved criteria, the CRM proactively notifies the user — showing which properties matched, which criteria triggered, and which pipeline run produced the data.

**Why this priority**: This is the core value proposition connecting both systems. It turns the pipeline from a passive data source into an active opportunity generator for the acquisition team.

**Independent Test**: Save criteria in the CRM, trigger a pipeline run that produces matching records, and verify the CRM generates a notification linking the match to the specific pipeline run and record delta.

**Acceptance Scenarios**:

1. **Given** a CRM User has saved criteria for properties with roofs older than 15 years in Arlington, **When** the pipeline publishes an update containing a new property matching those criteria, **Then** the CRM generates a notification identifying the property, the matching criteria, and the pipeline run that surfaced it.
2. **Given** a pipeline update changes an existing property's ownership history such that it now matches saved criteria, **When** the CRM processes the update, **Then** it detects the change as a new match and notifies the user with the specific field that changed.
3. **Given** a pipeline update contains no records matching any saved criteria, **When** the CRM processes the update, **Then** no notifications are generated.

---

### User Story 3 - Pipeline Run Traceability (Priority: P3)

Both the Oracle Operator and the CRM User can trace any record back to its pipeline origin. The Operator sees run history (timestamps, source list, record counts, deltas) in the pipeline UX. The CRM User sees provenance metadata on any property record — which sources contributed, when the data was last updated, and which pipeline run produced it.

**Why this priority**: Traceability builds trust in the data and is required for both personas to make informed decisions. The Operator needs it for pipeline health monitoring; the CRM User needs it to evaluate data freshness and reliability.

**Independent Test**: Complete a pipeline run, then verify the Operator can see run details in the pipeline UX and the CRM User can see source provenance on a property record that was part of that run.

**Acceptance Scenarios**:

1. **Given** a pipeline run has completed, **When** the Oracle Operator views the run history, **Then** they see the run timestamp, list of sources ingested, total record count, and delta (new/updated/removed records) for that run.
2. **Given** a property record in the CRM originated from a pipeline run, **When** the CRM User views the property detail, **Then** they see which sources contributed to the record, the last pipeline run that updated it, and the data collection timestamp.
3. **Given** multiple pipeline runs have occurred, **When** the Oracle Operator views run history, **Then** runs are listed chronologically with deltas showing how the dataset evolved over time.

---

### User Story 4 - Agent Queries Across the Integration (Priority: P4)

A CRM User asks the natural-language agent a property intelligence question (e.g., "Which properties have roofs older than 15 years and have not exchanged ownership in more than 10 years?"). The agent queries the local data layer (backed by pipeline-published artifacts) and returns source-backed answers with provenance.

**Why this priority**: The agent is a high-value differentiator but depends on the data contract (US1) and provenance (US3) being in place first.

**Independent Test**: Ensure the data layer has pipeline-published records loaded, then ask the agent a multi-attribute property question and verify the response includes matching properties with source attribution.

**Acceptance Scenarios**:

1. **Given** pipeline data is loaded in the local query layer, **When** a CRM User asks "Which properties near public transportation have regional owners?", **Then** the agent returns matching properties with coordinate-based distance logic and ownership evidence.
2. **Given** the agent returns property matches, **When** the user examines the results, **Then** each result includes source-backed evidence citing the pipeline data and provenance metadata.
3. **Given** the agent cannot fully answer a question due to missing data, **When** it responds, **Then** it clearly identifies which data is available, which is missing, and what assumptions it made.

---

### Edge Cases

- **IPNS resolution failure**: When the CRM receives a webhook but cannot resolve the new CID (network partition or gateway unavailability), it continues operating with the last successfully loaded data, retries resolution in the background, and surfaces a staleness warning to the user.
- **Schema changes**: Out of scope for the initial milestone (see Assumptions). The CRM assumes a stable artifact schema.
- **No-op pipeline update**: When the pipeline publishes a run with zero new records, the webhook fires, the CRM processes the artifact, finds no delta records matching any criteria, and generates no notifications.
- **Low-confidence reconciliation**: When duplicate records remain after reconciliation due to insufficient matching confidence, the pipeline includes them as separate records with provenance; deduplication quality is a pipeline sub-spec concern.
- **Rapid successive pipeline runs**: The CRM processes every artifact sequentially in the order webhook events are received, guaranteeing per-run notification granularity. No artifacts are skipped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST publish data artifacts to Elephant IPFS with content-addressed CIDs and stable IPNS pointers following Elephant/Lexicon conventions.
- **FR-002**: The pipeline MUST include run metadata with each published artifact: run timestamp, source list, record counts, and deltas (new/updated/removed).
- **FR-003**: The pipeline MUST reconcile duplicate entities across all ingested sources and preserve source provenance for every record.
- **FR-004**: The CRM MUST resolve pipeline data exclusively via IPNS pointers without requiring a hosted database.
- **FR-005**: The pipeline MUST send a webhook event to the CRM after publishing a new artifact, including the IPNS pointer and run identifier.
- **FR-006**: The CRM MUST process webhook events sequentially in order of receipt, resolve the referenced artifact, and run saved criteria against delta records to generate notifications for matches.
- **FR-012**: Each published artifact MUST be a full snapshot of all reconciled records, accompanied by delta metadata identifying new, updated, and removed records since the previous run.
- **FR-013**: The CRM MUST continue operating with the last successfully loaded data when artifact resolution fails, retry in the background, and display a staleness warning to the user.
- **FR-007**: Notifications MUST identify the matching property, the criteria that triggered the match, and the pipeline run that produced the data.
- **FR-008**: Property records in the CRM MUST display source provenance (contributing sources, pipeline run reference, data timestamp).
- **FR-009**: The natural-language agent MUST query the local data layer and return source-backed answers with provenance.
- **FR-010**: The pipeline MUST support continuous/incremental ingestion — not just one-time bulk loads.
- **FR-011**: Both systems MUST operate without Oracle-hosted database infrastructure costs.

### Key Entities

- **Pipeline Run**: A single execution of the ingestion pipeline; has a timestamp, source list, record counts, and a delta summary. Produces a published artifact.
- **Published Artifact**: A content-addressed data package on Elephant IPFS; referenced by a stable IPNS pointer; contains a full snapshot of all reconciled property records, run metadata, and delta metadata (new/updated/removed records since previous run).
- **IPNS Pointer**: A stable, resolvable name that always points to the latest published artifact CID. Part of the contract between pipeline (publisher) and CRM (consumer).
- **Webhook Event**: A push notification sent by the pipeline to the CRM after publishing a new artifact; contains the IPNS pointer and run identifier. The signaling mechanism that triggers CRM processing.
- **Property Record**: A reconciled entity representing a Duval County property with attributes from one or more sources; carries provenance metadata.
- **Saved Criteria**: A CRM User's named set of property filters (geographic, attribute-based, distress signals) that runs against each new pipeline update.
- **Notification**: An alert generated when a pipeline update produces records matching saved criteria; links to the property, the criteria, and the originating pipeline run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The CRM surfaces newly published pipeline records within 5 minutes of IPNS pointer update, without manual intervention.
- **SC-002**: 100% of property records displayed in the CRM include source provenance and pipeline run reference.
- **SC-003**: Saved criteria matches generate notifications for every qualifying record in a pipeline update with zero false negatives.
- **SC-004**: The end-to-end flow (pipeline ingestion → IPFS publish → CRM detection → criteria match → notification) completes successfully in a demo with real Duval County data.
- **SC-005**: Both systems operate with zero hosted-database cost — all data access is via local query engine and Elephant IPFS.
- **SC-006**: The natural-language agent answers property intelligence questions with source-backed evidence in under 10 seconds.
- **SC-007**: Pipeline run history shows at least 2 distinct runs with visible deltas demonstrating continuous/incremental ingestion.

## Assumptions

- The Elephant IPFS infrastructure (Filebase gateway, IPNS resolution) is available and performant enough for the CRM to resolve artifacts in near-real-time.
- The pipeline and CRM share a common understanding of the published artifact schema (record structure, field names, provenance format). Schema versioning is out of scope for the initial milestone.
- The candidate operates as both Oracle Operator and builder, so both systems are developed and demonstrated by the same person.
- Court data enrichment (foreclosure, lien, probate) is optional and does not affect the integration contract — it is an additive data source within the pipeline.
- Outreach channels in the CRM remain mocked; the integration contract covers data flow, not downstream CRM actions.
- Each sub-system (pipeline and CRM) will have its own independent spec-of-specs cycle; this parent spec governs only the integration touchpoints.
- The integration contract has two touchpoints: (1) the IPNS pointer for data access (pipeline publishes, CRM reads), and (2) a webhook for event signaling (pipeline pushes, CRM receives). No other coupling exists between the systems.
