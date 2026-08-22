# Data Model: Residential Property Acquisition CRM

**Date**: 2026-08-22 | **Feature**: specs/003-residential-jax-crm

## Data Layer Split

Property data lives on IPFS (read via DuckDB-WASM from Parquet). CRM state lives in Neon Postgres (managed via Drizzle ORM). The two layers join on `parcel_id`.

## Property Data (from Pipeline — DuckDB-WASM / Parquet)

Property records are **read-only** from the CRM's perspective. The schema is defined by the pipeline's published artifact contract (`specs/002-oracle-pipeline-duval/contracts/published-artifact.md`). Key columns used by the CRM:

| Column | Type | CRM Usage |
|--------|------|-----------|
| uuid | string | Internal reference |
| parcel_id | string | **Primary key** for CRM joins, deduplication |
| address_street | string | Display, search |
| address_city | string | Display |
| address_zip | string | Criteria filter |
| assessed_value | number | Criteria filter, display |
| market_value | number | Display |
| current_owner_name | string | Display, outreach |
| current_owner_mailing_address | string | Outreach (direct mail) |
| lat | number | Map display |
| lng | number | Map display |
| year_built | number | Display |
| sqft | number | Display |
| roof_age_years | number | Criteria filter (derived signal) |
| ownership_tenure_years | number | Criteria filter (derived signal) |
| is_regional_owner | boolean | Criteria filter (derived signal) |
| water_proximity_ft | number | Criteria filter (derived signal) |
| transit_distance_mi | number | Criteria filter (derived signal) |
| provenance_sources | string[] | Provenance display |
| provenance_last_run | string | Provenance display |
| provenance_timestamps | json | Provenance display |

## CRM State (Neon Postgres — Drizzle ORM)

### saved_criteria

A named set of search filters for proactive matching.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| name | text | NOT NULL | User-assigned name (e.g., "Arlington Distressed") |
| filters | jsonb | NOT NULL | Serialized filter configuration |
| geographic_bounds | jsonb | nullable | GeoJSON polygon or circle |
| notifications_enabled | boolean | default true | Whether to generate notifications on match |
| created_at | timestamp | default now | Creation timestamp |
| updated_at | timestamp | default now | Last modification |

**filters** JSONB shape:
```json
{
  "ownership_tenure_min_years": 10,
  "roof_age_min_years": 15,
  "zip_codes": ["32210", "32211"],
  "assessed_value_min": 50000,
  "assessed_value_max": 300000,
  "is_regional_owner": true,
  "water_proximity_max_ft": 1000
}
```

### pipeline_events

Webhook events received from the pipeline. Used for idempotency and provenance.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| event_id | uuid | PK | From webhook payload (dedup key) |
| run_id | uuid | NOT NULL | Pipeline run identifier |
| county | text | NOT NULL | County slug |
| ipns_pointer | text | NOT NULL | IPNS key for artifact |
| artifact_cid | text | NOT NULL | CID of published artifact |
| delta_new | integer | NOT NULL | New properties count |
| delta_updated | integer | NOT NULL | Updated properties count |
| delta_removed | integer | NOT NULL | Removed properties count |
| delta_parcel_ids | jsonb | NOT NULL | New + updated parcel IDs |
| received_at | timestamp | default now | When CRM received the event |
| processed_at | timestamp | nullable | When CRM finished processing |
| status | text | default 'pending' | `pending`, `processing`, `completed`, `failed` |

**State transitions**: `pending` → `processing` → `completed` | `failed`

### notifications

Alerts generated when pipeline updates match saved criteria.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| criteria_id | uuid | FK → saved_criteria.id | Which criteria triggered this |
| event_id | uuid | FK → pipeline_events.event_id | Which pipeline event triggered this |
| run_id | uuid | NOT NULL | Pipeline run reference |
| matched_count | integer | NOT NULL | Number of properties matching |
| matched_parcel_ids | jsonb | NOT NULL | Parcel IDs that matched |
| summary | text | NOT NULL | e.g., "12 new matches for 'Arlington Distressed'" |
| read | boolean | default false | Whether user has seen this |
| created_at | timestamp | default now | When notification was generated |

### opportunities

CRM acquisition records tracking property deals.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| parcel_id | text | NOT NULL, UNIQUE | Links to property in Parquet data |
| stage | text | NOT NULL, default 'identified' | `identified`, `contacted`, `negotiating`, `under_contract`, `closed`, `dead` |
| owner_name | text | nullable | Cached from property data |
| owner_contact_email | text | nullable | Manually entered |
| owner_contact_phone | text | nullable | Manually entered |
| owner_interest | text | nullable | `interested`, `not_interested`, `maybe`, `unknown` |
| asking_price | numeric | nullable | Owner's asking price |
| offer_amount | numeric | nullable | Investor's offer |
| notes | text | nullable | Free-text notes |
| next_steps | text | nullable | Planned next action |
| criteria_match_score | numeric | nullable | Match percentage at time of creation |
| source_criteria_id | uuid | FK → saved_criteria.id, nullable | Criteria that surfaced this property |
| created_at | timestamp | default now | When opportunity was created |
| updated_at | timestamp | default now | Last modification |

**Stage transitions**: `identified` → `contacted` → `negotiating` → `under_contract` → `closed` | `dead`
- Can also go `contacted` → `dead`, `negotiating` → `dead`
- `dead` is terminal

### opportunity_history

Audit trail for stage changes and notes.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| opportunity_id | uuid | FK → opportunities.id | Parent opportunity |
| from_stage | text | nullable | Previous stage (null for creation) |
| to_stage | text | NOT NULL | New stage |
| note | text | nullable | Note recorded with the change |
| created_at | timestamp | default now | When the change occurred |

### tasks

Follow-up actions assigned to team members.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| opportunity_id | uuid | FK → opportunities.id | Parent opportunity |
| title | text | NOT NULL | Task description |
| assignee | text | nullable | Assignee name (self or VA) |
| due_date | date | nullable | When task is due |
| completed | boolean | default false | Whether task is done |
| created_at | timestamp | default now | When task was created |

### outreach_records

Mocked communication records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, default gen | Unique identifier |
| opportunity_id | uuid | FK → opportunities.id | Parent opportunity |
| channel | text | NOT NULL | `email`, `sms`, `direct_mail` |
| status | text | NOT NULL, default 'sent' | `sent`, `delivered`, `replied`, `bounced` |
| recipient | text | NOT NULL | Owner name or address |
| subject | text | nullable | Email subject or SMS preview |
| sent_at | timestamp | default now | When outreach was initiated |
| status_updated_at | timestamp | nullable | When status last changed |

**Status transitions**: `sent` → `delivered` → `replied` | `bounced`
- Simulated progression: status advances automatically after random delays (mocked)

## Entity Relationships

```
Pipeline (IPFS Parquet) ←--parcel_id--→ opportunities (Neon)
saved_criteria ←--criteria_id--→ notifications
pipeline_events ←--event_id--→ notifications
opportunities ←--opportunity_id--→ opportunity_history (many)
opportunities ←--opportunity_id--→ tasks (many)
opportunities ←--opportunity_id--→ outreach_records (many)
opportunities ←--source_criteria_id--→ saved_criteria
```
