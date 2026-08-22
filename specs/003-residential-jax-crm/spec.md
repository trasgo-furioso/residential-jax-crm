# Feature Specification: Residential Property Acquisition CRM

**Feature Branch**: `feature/003-residential-jax-crm`

**Created**: 2026-08-22

**Status**: Draft

**Input**: PRD from discovery session + README.md stakeholder acceptance criteria

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Map-Based Property Discovery (Priority: P1)

A solo investor opens the CRM and sees an interactive map centered on Jacksonville / Duval County populated with residential properties from the continuous Duval Oracle pipeline. Properties display key attributes (parcel ID, address, owner name, assessed value, ownership tenure, roof-age indicators, and coordinates). The investor can pan, zoom, and click individual properties to see full detail with source provenance. A companion list view mirrors the map selection.

**Why this priority**: Discovery is the entry point for every acquisition workflow. Without a working map and data layer, no other feature delivers value.

**Independent Test**: Can be fully tested by loading the CRM, verifying properties render on the map with correct attributes, clicking a property to see its detail card, and switching between map and list views.

**Acceptance Scenarios**:

1. **Given** the CRM is loaded, **When** the investor opens the application, **Then** an interactive map centered on Jacksonville / Duval County displays residential properties with parcel ID, address, owner, assessed value, and coordinates.
2. **Given** properties are displayed on the map, **When** the investor clicks a property marker, **Then** a detail panel shows all available attributes including ownership history signals, roof-age indicators, and source provenance.
3. **Given** properties are displayed on the map, **When** the investor switches to list view, **Then** the same properties appear in a sortable, scrollable table with the same key attributes.

---

### User Story 2 - Criteria Search and Saved Searches (Priority: P1)

The investor defines target acquisition criteria — for example, ownership duration greater than 10 years, roof age greater than 15 years, specific zip codes, assessed-value bands, and optional distress signals. The system filters properties matching those criteria and displays results on the map and in a ranked list with match-score rationale. The investor saves the criteria set as a named search for reuse and proactive notification.

**Why this priority**: Criteria-based search is the core differentiator over manual tools. Without it, the CRM is just a map viewer.

**Independent Test**: Can be tested by defining criteria, verifying matching properties appear with correct ranking, saving the criteria set, and confirming it persists for future use.

**Acceptance Scenarios**:

1. **Given** the investor is on the search interface, **When** they define criteria (ownership > 10 years, roof age > 15 years, zip code 32210), **Then** matching properties appear on the map and in a ranked list with clear match-score rationale.
2. **Given** search results are displayed, **When** the investor saves the criteria as "Arlington Distressed", **Then** the named search persists and appears in a saved-searches list.
3. **Given** the investor has saved searches, **When** they select a saved search, **Then** the criteria are re-applied and current matching properties are displayed.
4. **Given** the search interface, **When** the investor draws a polygon or radius on the map, **Then** results are constrained to properties within the geographic boundary.

---

### User Story 3 - Proactive Pipeline Notifications (Priority: P2)

When the continuous Duval pipeline ingests new or updated records that match the investor's saved criteria, the system generates proactive notifications. In-app alerts appear with links to the specific property and the pipeline run that triggered the match. Notification history shows all past alerts with timestamps and trigger details.

**Why this priority**: Proactive alerts are what make this CRM superior to manual daily checks in PropStream — but they require working search and data layers first.

**Independent Test**: Can be tested by saving a criteria set, simulating a pipeline update with a matching record, and verifying a notification appears with correct property link and pipeline-run reference.

**Acceptance Scenarios**:

1. **Given** a saved criteria set with notifications enabled, **When** a pipeline update introduces a property matching the criteria, **Then** an in-app notification is generated linking to the property and referencing the pipeline run.
2. **Given** notifications have been generated, **When** the investor opens the notification panel, **Then** notification history shows each alert with timestamp, matched criteria name, and the specific record change that triggered it.
3. **Given** a notification for a new match, **When** the investor clicks the notification, **Then** they are taken directly to the property detail view.

---

### User Story 4 - CRM Acquisition Workflow (Priority: P2)

The investor converts a matching property into a CRM acquisition opportunity and tracks it through stages: Identified → Contacted → Negotiating → Under Contract → Closed / Dead. They record owner contact details, asking price, offers, notes, and next steps. Tasks can be assigned (to self or VA). The opportunity list can be filtered by stage, criteria match strength, geography, and distress signals.

**Why this priority**: Deal tracking is what eliminates spreadsheets. It depends on having properties and search working first.

**Independent Test**: Can be tested by creating an opportunity from a property, advancing it through stages, recording notes and offers, and filtering the opportunity list.

**Acceptance Scenarios**:

1. **Given** a property detail view, **When** the investor clicks "Create Opportunity", **Then** an opportunity record is created at stage "Identified" with the property and owner details attached.
2. **Given** an opportunity at stage "Identified", **When** the investor advances the stage to "Contacted" and records notes, **Then** the stage change and notes are persisted with timestamps.
3. **Given** multiple opportunities, **When** the investor filters by stage "Negotiating" and zip code 32205, **Then** only matching opportunities are displayed.
4. **Given** an opportunity, **When** the investor assigns a follow-up task to the VA, **Then** the task appears in the task list with assignee and due date.

---

### User Story 5 - Mocked Outreach Campaigns (Priority: P3)

The investor launches mocked outreach to property owners through simulated channels: email, SMS, and direct mail. Each outreach has a simulated lifecycle (sent → delivered → replied / bounced). Outreach history is visible on the opportunity record.

**Why this priority**: Outreach completes the end-to-end workflow but is mocked for the initial release — functional but not production-critical.

**Independent Test**: Can be tested by selecting an opportunity, launching a mocked email/SMS/mail campaign, and verifying simulated status progression appears in the outreach history.

**Acceptance Scenarios**:

1. **Given** an opportunity with owner contact details, **When** the investor sends a mocked email, **Then** the outreach record shows status "Sent" and progresses through simulated lifecycle states (Delivered, Replied/Bounced).
2. **Given** outreach has been sent, **When** the investor views the opportunity detail, **Then** all outreach attempts are listed with channel, timestamp, and current status.
3. **Given** multiple outreach channels, **When** the investor sends mocked SMS and direct mail, **Then** each channel's lifecycle is tracked independently.

---

### User Story 6 - Natural-Language Agent Queries (Priority: P3)

The investor asks natural-language questions through a RAG-backed agent interface — for example, "Which residential properties in the Arlington area match my distressed criteria and have not been contacted yet?" The agent returns relevant matches with source-backed evidence drawn from the Duval pipeline data.

**Why this priority**: The agent adds convenience but the core search and workflow function without it.

**Independent Test**: Can be tested by typing a natural-language query and verifying the agent returns relevant properties with cited sources.

**Acceptance Scenarios**:

1. **Given** the agent interface, **When** the investor asks "show distressed properties in Arlington with roofs older than 15 years that have not sold in 10+ years", **Then** matching properties are returned with match rationale and source references.
2. **Given** the agent has returned results, **When** the investor clicks a result, **Then** they navigate to the property detail view.

---

### User Story 7 - Export and Future Placeholders (Priority: P3)

The investor exports selected properties, owners, and opportunity records for downstream analysis or mailing. The CRM shows disabled/placeholder sections for future expansion (disposition tracking, portfolio management, live messaging integrations).

**Why this priority**: Export and placeholders are polish features that round out the demo but don't block core workflows.

**Independent Test**: Can be tested by selecting records, clicking export, and verifying a downloadable file is produced. Placeholder sections should be visible but non-interactive.

**Acceptance Scenarios**:

1. **Given** a filtered list of opportunities, **When** the investor clicks "Export", **Then** a downloadable file (CSV or similar) is produced containing the selected records.
2. **Given** the CRM navigation, **When** the investor browses the sidebar, **Then** placeholder sections for disposition, portfolio tracking, and live messaging are visible but clearly disabled.

---

### Edge Cases

- What happens when the pipeline delivers a property update that changes a previously-matching property to no longer match saved criteria? The property should be removed from active match results but the notification history should retain the original match event.
- How does the system handle a pipeline update with thousands of new matching properties? Notifications should be batched or summarized rather than generating thousands of individual alerts.
- What happens when the investor tries to create an opportunity for a property that already has one? The system should warn and link to the existing opportunity rather than creating a duplicate.
- How does the map perform with the full Duval County property dataset (hundreds of thousands of records)? The map should use clustering or progressive loading to remain responsive.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display Duval County residential properties on an interactive map with parcel ID, address, owner name, assessed value, ownership tenure, roof-age indicators (where available), and geographic coordinates.
- **FR-002**: System MUST support both map view (with clickable markers) and list view (sortable table) for property browsing, with synchronized selection.
- **FR-003**: System MUST preserve and display source provenance (pipeline run, collection timestamp, data source) for every property record.
- **FR-004**: System MUST allow users to define acquisition criteria including: ownership duration thresholds, roof-age thresholds, zip code or neighborhood filters, assessed-value bands, geographic bounds (radius or polygon), and optional distress signals.
- **FR-005**: System MUST rank and display matching properties with a clear match-score rationale showing which criteria each property satisfies.
- **FR-006**: System MUST allow users to save named criteria sets and recall them for future searches.
- **FR-007**: System MUST generate in-app notifications when new or updated pipeline records match saved criteria, linking to the specific property and pipeline run.
- **FR-008**: System MUST maintain a notification history showing timestamp, matched criteria name, and the record change that triggered each alert.
- **FR-009**: System MUST support creating CRM opportunity records from properties with stages: Identified → Contacted → Negotiating → Under Contract → Closed / Dead.
- **FR-010**: System MUST record owner interest level, asking price, offer amounts, free-text notes, next steps, and task assignments on each opportunity.
- **FR-011**: System MUST support mocked outreach through email, SMS, and direct mail channels with simulated lifecycle tracking (Sent → Delivered → Replied / Bounced).
- **FR-012**: System MUST support filtering opportunities by stage, criteria match strength, geography, ownership signals, and distress indicators.
- **FR-013**: System MUST provide a RAG-backed agent interface that accepts natural-language queries and returns matching properties with source-backed evidence.
- **FR-014**: System MUST support exporting selected properties, owners, and opportunity records as downloadable files.
- **FR-015**: System MUST consume data from the continuous Duval Oracle pipeline rather than a static one-time data load.
- **FR-016**: System MUST operate without requiring Oracle to carry ongoing hosted-database costs beyond the existing DuckDB / Elephant IPFS pattern.

### Key Entities

- **Property**: A residential parcel in Duval County with attributes from the Oracle pipeline (parcel ID/RE#, address, coordinates, assessed value, ownership history, permit history, roof-age indicators). Core entity for all search, display, and CRM operations.
- **Owner**: The recorded owner(s) of a property with name, mailing address, and contact details (where available). Linked to properties and opportunities.
- **Saved Criteria Set**: A named collection of search filters (ownership duration, roof age, zip codes, value bands, geographic bounds, distress signals) that can be recalled and used for proactive matching.
- **Notification**: An alert generated when a pipeline update produces a property matching a saved criteria set. Includes reference to the matched criteria, the property, and the pipeline run.
- **Opportunity**: A CRM record tracking the acquisition pursuit of a specific property, with stage progression, financial details (asking price, offers), notes, tasks, and linked outreach records.
- **Outreach Record**: A mocked communication sent to a property owner via email, SMS, or direct mail, with simulated lifecycle status.
- **Pipeline Run**: A reference to a specific execution of the Duval Oracle pipeline, used for provenance and notification attribution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Investor can go from opening the CRM to viewing a filtered set of matching properties in under 60 seconds.
- **SC-002**: The end-to-end workflow (define criteria → search → save → receive notification → create opportunity → send outreach → advance stage) is completable within a single session without leaving the CRM.
- **SC-003**: Proactive notifications appear within 5 minutes of a simulated pipeline update that introduces matching records.
- **SC-004**: The map remains responsive (interactions under 2 seconds) when displaying the full Duval County residential dataset.
- **SC-005**: Natural-language agent queries return relevant results with cited sources for at least 80% of queries matching the demo transcript examples.
- **SC-006**: 100% of displayed property records include visible source provenance (pipeline run reference and collection timestamp).
- **SC-007**: Exported files contain all selected records with complete attribute data and are immediately usable for mailing or analysis without manual cleanup.

## Assumptions

- The Duval County Oracle pipeline data is fresh and rich enough to replace PropStream/BatchLeads as the primary source for property discovery in the Jacksonville market.
- A solo investor will adopt the unified CRM workflow over spreadsheets if it is faster and more reliable for the same tasks.
- Mocked outreach channels (email, SMS, direct mail) with simulated lifecycle states are sufficient for the initial release — no live messaging integrations are needed.
- The continuous pipeline (DuckDB / Elephant IPFS pattern) can serve the CRM at Duval County scale without requiring Oracle to carry ongoing hosted-database costs.
- Court-data enrichment (foreclosure, lien, probate) is optional and additive — the core product is viable with assessor, permit, and ownership data alone.
- The primary user is a single investor or small team (1-2 people); multi-tenant, role-based access control is not required for the initial release.
- The CRM will be deployed to a hosted runtime accessible without local setup, per Elephant Platform constitution requirements.
