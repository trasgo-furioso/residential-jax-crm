# Roadmap: Oracle Pipeline + Residential CRM Integration

Replace the Oracle-hosted property intelligence platform with a zero-cost architecture using DuckDB + Elephant IPFS. The pipeline ingests and publishes Duval County property data; the CRM consumes it for acquisition workflows. Too large for one cycle — split into two independent sub-features connected by a webhook + IPNS contract.

**Parent spec**: `specs/001-oracle-crm-integration/spec.md`

**Status legend**: planned · in-progress · done

| ID | Sub-feature              | Intent                                                                                          | Scope boundary                                                                                                                                              | Depends on | Status  | Sub-spec |
|----|--------------------------|-------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------|---------|----------|
| R1 | Oracle Pipeline          | Continuously ingest Duval County property data, reconcile duplicates, publish full-snapshot artifacts with delta metadata to Elephant IPFS, and send webhook events | In: ingestion, reconciliation, DuckDB storage, IPFS publishing, webhook signaling, pipeline run history UI. Deferred: court data enrichment (optional), schema versioning | —         | in-progress | specs/002-oracle-pipeline-duval/ |
| R2 | Residential CRM          | Consume pipeline artifacts via webhook + IPNS, enable property search, saved criteria matching, proactive notifications, and acquisition workflow management   | In: webhook receiver, IPNS resolution, search/map UI, criteria matching, notifications, CRM workflow, agent queries. Deferred: live outreach, multi-county expansion | R1        | planned | — |
