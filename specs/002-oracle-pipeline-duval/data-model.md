# Data Model: Oracle Pipeline — Duval County

**Date**: 2026-08-20 | **Feature**: specs/002-oracle-pipeline-duval

## Pipeline Run

A single execution of the ingestion pipeline.

| Field | Type | Description |
|-------|------|-------------|
| run_id | UUID | Unique identifier for this run |
| county | string | County slug (e.g., `duval`) |
| started_at | timestamp | When the run began |
| completed_at | timestamp | When the run finished (null if in progress) |
| status | enum | `running`, `success`, `partial`, `failed` |
| sources | Source[] | List of sources ingested in this run |
| record_count | integer | Total records after this run |
| delta_new | integer | Count of new records in this run |
| delta_updated | integer | Count of updated records in this run |
| delta_removed | integer | Count of removed records in this run |
| source_limitations | string[] | Documented issues (slow/unavailable sources) |
| published_artifact_cid | string | CID of the published artifact (null if not yet published) |
| ipns_pointer | string | IPNS name after publish (null if not yet published) |

**State transitions**: `running` → `success` | `partial` | `failed`
- `success`: All sources ingested, all records reconciled, artifact published
- `partial`: Some sources failed, available data ingested and published
- `failed`: Critical failure, no data published

## Data Source

A Duval County public data source.

| Field | Type | Description |
|-------|------|-------------|
| source_id | string | Unique identifier (e.g., `duval-appraiser`, `duval-permits`) |
| name | string | Human-readable name |
| category | enum | `property`, `permit`, `ownership`, `business`, `contractor`, `location` |
| url | string | Base URL of the source portal |
| collection_method | enum | `browser-flow`, `api`, `bulk-download`, `scrape` |
| last_successful_run | timestamp | When this source was last successfully ingested |
| record_count | integer | Records from this source in current dataset |
| limitations | string | Known limitations (rate limits, missing fields, etc.) |

## Property Record (Lexicon-aligned)

A reconciled entity representing a Duval County property. Follows Elephant Lexicon schema with extensions for query support.

| Field | Type | Description |
|-------|------|-------------|
| uuid | UUID | Internal unique identifier |
| parcel_id | string | County-assigned parcel identifier (RE#) |
| address | Address | Standardized property address (Lexicon `address` entity) |
| county_jurisdiction | string | Always `duval` |
| assessed_value | number | County-assessed property value |
| market_value | number | Market value if available |
| ownership | Ownership[] | Ownership history records |
| current_owner | Owner | Current owner entity |
| permits | Permit[] | Building/construction permits |
| structure | Structure | Building characteristics (year built, sqft, etc.) |
| lot | Lot | Lot dimensions and area |
| coordinates | Geometry | Lat/lng point or parcel polygon |
| tax | Tax | Tax assessment records |
| provenance | Provenance | Source attribution metadata |
| derived_signals | DerivedSignals | Computed query-support attributes |

### Provenance (attached to every record)

| Field | Type | Description |
|-------|------|-------------|
| contributing_sources | string[] | Source IDs that contributed to this record |
| collection_timestamps | Record<string, timestamp> | Per-source collection timestamp |
| last_pipeline_run | UUID | Run ID that last updated this record |
| source_artifact_uri | string | Link to the transformed.zip for this record |
| reconciliation_confidence | number | 0-1 score of dedup match confidence |

### Derived Signals (computed at ingestion for query support)

| Field | Type | Description |
|-------|------|-------------|
| roof_age_years | number | Years since roof permit or year built |
| ownership_tenure_years | number | Years since last ownership transfer |
| is_regional_owner | boolean | Owner address outside Duval County/Florida |
| water_proximity_ft | number | Distance to nearest water body (NHD) |
| is_waterfront | boolean | Within 500ft of water body |
| transit_distance_mi | number | Distance to nearest transit stop (GTFS) |
| starbucks_distance_mi | number | Distance to nearest Starbucks (OSM) |
| within_walking_transit | boolean | Transit stop within 0.5 miles |
| within_walking_starbucks | boolean | Starbucks within 0.5 miles |

## Published Artifact

Content-addressed data package on Elephant IPFS.

| Field | Type | Description |
|-------|------|-------------|
| cid | string | CIDv1 (raw codec, SHA-256) |
| ipns_label | string | IPNS label (e.g., `oracle-open-data-duval`) |
| ipns_key | string | IPNS network key (`k51...`) |
| county | string | County slug |
| published_at | timestamp | When published to IPFS |
| run_id | UUID | Pipeline run that produced this artifact |
| property_count | integer | Total properties in snapshot |
| delta | DeltaSummary | Changes since previous artifact |

### DeltaSummary

| Field | Type | Description |
|-------|------|-------------|
| new_count | integer | Properties added |
| updated_count | integer | Properties modified |
| removed_count | integer | Properties removed |
| new_parcel_ids | string[] | Parcel IDs of new properties |
| updated_parcel_ids | string[] | Parcel IDs of updated properties |
| removed_parcel_ids | string[] | Parcel IDs of removed properties |

## Webhook Event

Push notification sent to consumers after artifact publication.

| Field | Type | Description |
|-------|------|-------------|
| event_id | UUID | Unique event identifier |
| event_type | string | Always `artifact.published` |
| county | string | County slug |
| run_id | UUID | Pipeline run identifier |
| ipns_pointer | string | IPNS key for the published artifact |
| artifact_cid | string | CID of the new artifact |
| timestamp | timestamp | When the event was generated |
| delta | DeltaSummary | Changes in this publish |

## Saved Criteria (CRM-side, for reference)

| Field | Type | Description |
|-------|------|-------------|
| criteria_id | UUID | Unique identifier |
| name | string | User-assigned name |
| filters | Filter[] | List of attribute filters |
| geographic_bounds | GeoJSON | Optional polygon or radius |
| created_by | string | User identifier |
| webhook_url | string | Where to receive match notifications |

## Entity Relationships

```
Pipeline Run --produces--> Published Artifact
Pipeline Run --ingests-from--> Data Source (many)
Pipeline Run --creates/updates--> Property Record (many)
Property Record --has--> Provenance
Property Record --has--> Derived Signals
Published Artifact --contains--> Property Record (all, as snapshot)
Published Artifact --has--> DeltaSummary
Webhook Event --references--> Published Artifact
Webhook Event --references--> Pipeline Run
```
