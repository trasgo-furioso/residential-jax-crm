# Contract: Published Artifact

**Consumer**: CRM (R2), MCP servers, any IPNS subscriber
**Producer**: Oracle Pipeline publish step

## Resolution

Consumers resolve the artifact via IPNS pointer:
```
https://ipfs.filebase.io/ipns/<ipns_key>/
```

Or via direct CID:
```
https://ipfs.filebase.io/ipfs/<artifact_cid>/
```

## IPNS Labels

| Label | Purpose |
|-------|---------|
| `oracle-open-data-duval` | Full property records (1 JSON per property + sharded index) |
| `oracle-query-table-duval` | Query table (single Parquet file for DuckDB) |

## Open Data Layout

```
<bucket root>/
├── index.json                      # Root index
├── manifest.json                   # Flat manifest (back-compat)
├── delta.json                      # Delta metadata (new for this spec)
├── shards/
│   ├── shard-0000.json             # Index shard (~10k properties each)
│   ├── shard-0001.json
│   └── ...
└── properties/
    ├── <uuid-1>.json               # Per-property consolidated JSON
    ├── <uuid-2>.json
    └── ...
```

### index.json

```json
{
  "county": "duval",
  "property_count": 245000,
  "shard_count": 25,
  "published_at": "2026-08-20T14:30:00.000Z",
  "run_id": "660e8400-e29b-41d4-a716-446655440001",
  "shards": [
    { "file": "shards/shard-0000.json", "count": 10000 },
    { "file": "shards/shard-0001.json", "count": 10000 }
  ]
}
```

### delta.json

```json
{
  "run_id": "660e8400-e29b-41d4-a716-446655440001",
  "previous_run_id": "550e8400-e29b-41d4-a716-446655440000",
  "previous_cid": "bafybeif...",
  "new_count": 142,
  "updated_count": 38,
  "removed_count": 0,
  "new_parcel_ids": ["RE0001234", "RE0001235"],
  "updated_parcel_ids": ["RE0009876"],
  "removed_parcel_ids": []
}
```

### Per-Property JSON (Lexicon-compliant)

Each property file follows the Elephant Lexicon schema with provenance metadata:

```json
{
  "uuid": "a1b2c3d4-...",
  "parcel_id": "RE0001234",
  "address": { "street": "123 Main St", "city": "Jacksonville", "state": "FL", "zip": "32202" },
  "county_jurisdiction": "duval",
  "assessed_value": 185000,
  "ownership": [{ "owner_name": "Smith, John", "transfer_date": "2015-03-15" }],
  "structure": { "year_built": 2005, "sqft": 1800, "roof_type": "shingle" },
  "coordinates": { "lat": 30.3322, "lng": -81.6557 },
  "provenance": {
    "contributing_sources": ["duval-appraiser", "duval-permits"],
    "collection_timestamps": { "duval-appraiser": "2026-08-20T10:00:00Z" },
    "last_pipeline_run": "660e8400-...",
    "reconciliation_confidence": 0.98
  }
}
```

## Query Table Layout

```
<bucket root>/
└── query-tables/duval/query-table.parquet
```

Single Parquet file with one row per property. Columns include all searchable attributes plus derived signals (roof_age_years, ownership_tenure_years, is_regional_owner, water_proximity_ft, transit_distance_mi, starbucks_distance_mi).

DuckDB reads this via httpfs:
```sql
CREATE VIEW properties AS
SELECT * FROM read_parquet('https://ipfs.filebase.io/ipns/<key>/query-tables/duval/query-table.parquet');
```

## Compatibility

- CID version: v1
- Codec: raw (0x55)
- Hash: SHA-256 (0x12)
- JSON canonicalization: RFC 8785
- Schema: Elephant Lexicon (validated via `elephant-cli validate`)
