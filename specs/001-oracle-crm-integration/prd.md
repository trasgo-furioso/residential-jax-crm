# PRD: Oracle Pipeline + Residential CRM Integration

**Created**: 2026-08-20
**Discovery Session**: 2026-08-20
**Status**: Planning

## Problem Statement

**Pain Point**: The current Oracle-hosted database platform for Duval County property intelligence carries ongoing infrastructure cost that the Oracle operator should not have to bear. Acquisition teams need continuous access to property data for distressed-property identification and outreach, but the hosting model is unsustainable.

**Who**: Two distinct personas with separate UX surfaces:
1. **Oracle Operator** — manages the continuous ingestion pipeline, monitors runs, reconciles data, and publishes artifacts to Elephant IPFS
2. **CRM User** — acquisition team member (investor, wholesaler, buy-and-hold operator) who searches properties, defines target criteria, receives proactive notifications, and manages the acquisition workflow

**Current Alternatives**: Oracle-hosted database platform used for county property queries. The problem is the ongoing infrastructure cost that the operator must carry to keep the system available.

**Desired Outcome**: A zero-Oracle-hosted-cost architecture where:
- The pipeline continuously and incrementally ingests Duval County property, permit, ownership, and location data into DuckDB and publishes artifacts to Elephant IPFS with stable IPNS pointers following Elephant/Lexicon conventions
- The CRM subscribes to those IPNS pointers, detects changes per pipeline run, and triggers criteria matching and proactive notifications
- Pipeline run history (timestamps, source list, record counts, deltas) is visible and traceable from both the operator and CRM sides
- Notifications in the CRM link back to the specific pipeline run and record change that triggered them
- The entire runtime operates on DuckDB + Elephant IPFS — no hosted database required

## Jobs to Be Done

- When the pipeline ingests new or changed Duval County records, I want those changes to automatically surface in the CRM as matched candidates, so I can act on opportunities without manually checking for updates.
- When I define acquisition criteria in the CRM (roof age, ownership tenure, distress signals), I want those criteria to run against the continuously updated pipeline data, so I can get proactive notifications as soon as matching properties appear.
- When the pipeline publishes data to Elephant IPFS, I want the CRM to resolve those artifacts via IPNS without a hosted database, so I can operate the full system at zero Oracle infrastructure cost.
- When I review a notified property in the CRM, I want to see which pipeline run and record change triggered the alert with full source provenance, so I can trust the data and make informed acquisition decisions.
- When I ask the agent a natural-language question about properties, I want it to query the DuckDB layer backed by pipeline-published data, so I can explore the dataset without writing queries or navigating the UI.
- When the pipeline detects duplicate entities across sources, I want reconciled records in the CRM rather than duplicates, so I can avoid contacting the same owner twice or misvaluing a property.

## Assumptions

- The candidate acts as both Oracle operator and builder — same person is responsible for completing the pipeline and proving the infrastructure approach.
- DuckDB + Elephant IPFS is sufficient to replace Oracle-hosted infrastructure for all property intelligence queries the CRM needs.
- Duval County public data sources are accessible for continuous/incremental ingestion (property, permit, ownership, business, contractor, location records).
- Elephant protocol conventions (Lexicon, CIDs, IPNS, Filebase) are mature enough to serve as the data transport layer between pipeline and CRM.
- Outreach channels remain mocked — no live messaging to property owners is expected for this milestone.
- Single-county scope (Duval/Jacksonville) for the initial milestone, though architecture should remain extensible to other counties.
- Court data enrichment is optional — foreclosure, lien, probate, and code enforcement ingestion is a nice-to-have, not a requirement for the integration contract.
- Each system gets its own spec structure — this parent spec defines the contract; the pipeline and CRM each run their own specify → plan → tasks → implement cycles independently.
