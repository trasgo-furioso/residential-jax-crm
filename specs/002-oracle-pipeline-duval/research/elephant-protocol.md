# Elephant Protocol -- Research Document

**Date**: 2026-08-20
**Scope**: Oracle mining pipeline for Duval County, FL
**Sources**: Elephant Oracle Skills repository (`elephant-xyz/skills`), Elephant Protocol litepaper/whitepaper, `elephant-xyz/docs` (TECH_STACK.md), `elephant-xyz/elephant-cli`, `elephant-xyz/elephant-mcp`, Perplexity web research

---

## 1. Protocol Architecture Overview

Elephant Protocol is a decentralized network for creating, validating, storing, and monetizing verified property data. It separates responsibilities across distinct layers:

```
Source records
  -> Oracle extraction
  -> Lexicon validation
  -> Canonical JSON (RFC 8785)
  -> Hash consensus (Polygon PoS)
  -> IPFS/IPLD storage
  -> Token issuance (MAHOUT / vMAHOUT)
```

### Layer Summary

| Layer | Technology | Purpose |
|---|---|---|
| Data Ingestion | Oracles + elephant-cli | Collect property data from county/public sources |
| Schema & Canonicalization | Lexicon + SchemaLink + RFC 8785 | Normalize data so identical records hash identically |
| Validation | JSON Schema + elephant-cli validate | Ensure schema compliance before submission |
| Storage | IPFS + IPLD | Content-addressed, decentralized, immutable storage |
| Consensus | Polygon PoS smart contracts | On-chain hash consensus + reward distribution |
| Application | MCP servers, Fact Sheets, NEO | Query and present verified property data |

The blockchain does NOT store property data directly. It stores consensus proofs (hashes/CIDs), token accounting, and pointers that allow anyone to retrieve and verify the corresponding off-chain data from IPFS.

### Three Oracle Types

| Oracle Type | Contribution | Validation Model |
|---|---|---|
| **Technical** | Operates the data pipeline: identify, prepare, transform, validate, hash, upload, submit | Hash consensus (3 oracles) |
| **Institutional** | Contributes authoritative jurisdictional records (county appraiser, permits, tax, ownership) | Hash consensus (3 oracles) |
| **Owner/Provider** | Contributes property-specific evidence not available in bulk records (photos, inspections, appraisals) | Reputation-based (1 oracle) |

---

## 2. Lexicon Schema Structure

### What It Is

The Elephant Lexicon is the protocol's common vocabulary and data model for property information. It makes records from different counties and data providers interoperable by expressing them as structured, validated JSON rather than arbitrary provider-specific formats.

### What It Provides

- Standard names for property concepts and fields
- Types and formats for values (dates, numbers, addresses, identifiers, ownership records)
- Validation rules for required and permitted fields
- A consistent way to represent different property data elements
- A basis for deterministic canonicalization and hashing
- A structure that applications can consume without writing a separate parser for every county

### Data Organization

A property is represented as a linked collection of data elements (not one monolithic document). Each element can be updated, verified, linked, and rewarded independently. The Lexicon defines entity types such as:

- `property` -- core property identity and characteristics
- `address` / `unnormalized_address` -- situs and mailing addresses
- `parcel` -- parcel identity (parcel_id, jurisdiction, source identifiers)
- `tax` -- tax records
- `sales_history` / `deed` -- ownership transfer records
- `structure` / `layout` -- building/improvement characteristics
- `lot` -- lot dimensions and area
- `utility` -- utility information
- `ownership` / `person` / `company` -- owner entities
- `geometry` -- coordinates, polygons
- `flood_storm_information` -- environmental hazard data
- `property_valuation` -- assessed/market values
- `file` -- media attachments (photos, documents)

### Schema Validation Chain

```
Lexicon (domain model)
    |
    v
Defines the allowed property-data concepts and relationships
    |
    v
SchemaLink (JSON Schema + CID-linked references)
    |
    v
Adds content-addressed references and blockchain-oriented constraints
    |
    v
JSON Schema validation
    |
    v
RFC 8785 Canonical JSON serialization
    |
    v
Deterministic hash -> on-chain submission
```

**SchemaLink** extends JSON Schema with a `cid` keyword that allows schema fields to point to other schemas by content identifier, enabling schemas for related entities (property, lot, ownership, mortgage) to be linked without embedding every definition into one monolithic schema.

### How to Use It in Our Pipeline

The pipeline must transform raw Duval County data into Lexicon-compliant JSON. The key tool is `elephant-cli transform --transform-version 2`, which takes:

- **Input**: A Browser Flow v2 prepared ZIP with `address.json`, `parcel.json`, `captures.json`, and `captures/*.html`
- **Transform package**: A ZIP with root ESM `handler.js` that reads captures and writes entity/relationship outputs
- **Output**: Lexicon-compliant JSON files under `data/` in the output ZIP

The handler contract uses:
- `writeJson(name, value)` for entity outputs (property, address, tax, etc.)
- `writeRelationship({ type, name, from, to })` for relationship outputs
- `readCapture(name)` to access raw HTML captures

Key rules from the skills:
- Snake_case filename stems, no `.json` suffix
- CLI auto-sets `request_identifier` from `parcel.json`
- Unmapped source codes must be preserved in `source_payload`, never thrown
- `elephant-cli validate` must pass before any data reaches the DB or IPFS

### Cross-Jurisdictional Consistency

The Lexicon schema is what makes cross-county consistency possible. Without it, two oracles processing the same source could produce equivalent information in different formats and fail to reach hash consensus. The canonical serialization (RFC 8785) ensures formatting differences (whitespace, key order) do not change the hash.

For Duval County specifically, we must:
1. Map Duval's appraiser field names to Lexicon field names
2. Map Duval's DOR use codes to Lexicon enum values (skip-and-warn for unmapped codes)
3. Parse `unnormalized_address` into structured fields when structured columns are null
4. Set `county_jurisdiction` correctly for every output

---

## 3. IPFS Publishing Patterns

### Content-Addressed Storage Model

Elephant standardizes on:
- **CID v1** (not v0)
- **Raw codec** (`0x55`)
- **SHA-256** (`0x12`) hashing

When canonical data is added to IPFS, it receives a CID derived from its content. The same content always produces the same CID. Changing even one byte produces a different CID.

### IPLD and Merkle DAG

IPLD (InterPlanetary Linked Data) links related IPFS objects into structured graphs. Each node is addressed by the hash of its serialized content, and references to other nodes are represented by content-addressed CID links.

```
Property index (root CID)
    |
    +-- Fact-group objects
    |       +-- Source/document objects (address.json, tax.json, etc.)
    |
    +-- Linked assets (HTML captures, images)
```

This forms a **Merkle DAG**: changing a child object changes its CID, which changes the identifiers of objects that reference it, creating tamper-evident version relationships across the property graph.

### Filebase as IPFS Provider

The Elephant oracle skills use **Filebase** (not Pinata) as the IPFS pinning provider for the pipeline's open-data publishing layer. Filebase provides:

- S3-compatible upload API (`https://s3.filebase.io`) -- objects uploaded via `@aws-sdk/client-s3` are automatically pinned to IPFS
- CIDs returned in upload response metadata
- IPNS name management via Platform API (`https://api.filebase.io/v1/names`)
- Gateway access at `https://ipfs.filebase.io/ipfs/<CID>` and `https://ipfs.filebase.io/ipns/<name>`

**Credentials** (stored in `elephant-pipeline/.env`, never committed):
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` -- Filebase keys
- `S3_ENDPOINT` = `https://s3.filebase.io`
- `S3_BUCKET` = `elephant-oracle-open-data-<county>` (per-county bucket, never shared)

### CID Pre-computation

CIDs are pre-computed locally with `ipfs-only-hash` before upload. Its algorithm matches Filebase's, so nothing needs to be read back from S3 metadata after upload.

### IPNS (Stable Pointers)

IPNS provides mutable pointers that reference the latest immutable CID. This is the mechanism that lets consumers auto-get updated data with zero re-configuration.

**Publishing pattern**:
```
IPNS name (stable, e.g., k51qzi5uqu5d...)
    |
    v
Latest index CID (changes on each publish)
    |
    v
Sharded index (index.json + shards/shard-NNNN.json)
    |
    v
Per-property CIDs (<uuid>.json files)
```

**IPNS API** (Filebase Platform API):
- Base URL: `https://api.filebase.io/v1/names` (NOT `/v1/ipns`)
- Auth: `Authorization: Bearer base64(S3_ACCESS_KEY_ID:S3_SECRET_ACCESS_KEY)`
- `POST /v1/names` with `{"label","cid"}` to create
- `PUT /v1/names/{label}` with `{"cid"}` to re-point (the re-publish operation)
- Response `network_key` field is the resolvable `k51...` IPNS name

**IPNS Resolution** (for MCP/consumers):
- Public gateways dropped the Kubo RPC `/api/v0/name/resolve` endpoint
- Resolve via HEAD request against `https://<name>.ipns.dweb.link/` and read the `x-ipfs-roots` response header
- Or use `https://ipfs.filebase.io/ipns/<name>`

### Per-County Bucket Convention

Each county needs its OWN bucket and IPNS label. The upload writes FIXED keys (`index.json`, `manifest.json`, `shards/shard-*.json`), so reusing a bucket clobbers the other county.

**Naming convention**:
- Open data bucket: `elephant-oracle-open-data-<county>`
- Open data IPNS label: `oracle-open-data-<county>`
- Query table bucket: `elephant-oracle-query-table-<county>` (separate)
- Query table IPNS label: `oracle-query-table-<county>`

**Per-county env vars** (resolved by `Publish` virtual object):
- `FILEBASE_OPEN_DATA_BUCKET_<COUNTY>` (e.g., `FILEBASE_OPEN_DATA_BUCKET_DUVAL`)
- `FILEBASE_QUERY_TABLE_BUCKET_<COUNTY>` (e.g., `FILEBASE_QUERY_TABLE_BUCKET_DUVAL`)
- `FILEBASE_ACCESS_KEY` / `FILEBASE_SECRET_KEY` (shared or per-county)
- `<COUNTY>` segment is the slug uppercased, non-alphanumeric -> `_` (e.g., `palm-beach` -> `PALM_BEACH`)

### Data Layout on IPFS

**Open data (1 JSON per property + sharded index)**:
```
bucket root/
    properties/<uuid>.json          # one consolidated JSON per property
    shards/shard-0000.json          # index shards (~10k properties each)
    shards/shard-0001.json
    ...
    index.json                      # root index (references shards, carries propertyCount)
    manifest.json                   # flat manifest for back-compat
```

**Query table (single Parquet file)**:
```
bucket root/
    query-tables/<county>/query-table.parquet   # one-row-per-property, ~37 columns
```

### Publication Lifecycle

```
Query DB (loaded + reconciled)
    |
    v  npm run export:property-consolidation
Per-property JSON + sharded index (staged locally)
    |
    v  npm run publish:ipfs-upload (via Publish virtual object)
Filebase S3 bucket (CIDs pinned to IPFS)
    |
    v  PUT /v1/names/{label} {"cid":"<new index CID>"}
IPNS re-pointed (consumers auto-get new data)
    |
    v
MCP resolves IPNS -> serves latest data
```

---

## 4. Oracle Mining Flow

### The Nine-Step Process

```
1. Property Identification
    |
    v
2. Prepare (capture source material)
    |
    v
3. Enrich (add relationships and evidence)
    |
    v
4. Transform (raw -> canonical Lexicon JSON)
    |
    v
5. Validate (schema compliance + evidence)
    |
    v
6. Hash (CIDv1 + SHA-256 of canonical content)
    |
    v
7. Upload (to IPFS, receiving CID)
    |
    v
8. Submit (hash/CID commitment to Polygon contract)
    |
    v
9. Token Issuance (MAHOUT + vMAHOUT)
```

### Step Details

**1. Property Identification**
Establish canonical property identity using parcel identifier, address, jurisdiction, and source identifier. Input requires `parcel_id`, `address`, `source_identifier`. In our pipeline: seed CSV at `data/seeds/<county>.csv` drives the `CountyIngest` feeder.

**2. Prepare**
Retrieve the relevant source response. For web-based records: fetch HTML from county appraiser/permit portals and package the response deterministically.
- `elephant-cli prepare` with Browser Flow v2 JSON or plain-HTTP fetcher
- Output: `capture.zip` with `address.json`, `parcel.json`, `captures.json`, `captures/*.html`
- Deterministic path + skip-existing: re-runs never re-scrape

**3. Enrich**
Source records are supplemented with relationships and additional evidence (owner, parcel, address, permit, property-improvement relationships). In our pipeline: the transform handler reads captures and writes all entity and relationship outputs.

**4. Transform**
Raw source material is converted into Elephant's canonical schemas.
- `elephant-cli transform --transform-version 2`
- County-specific handler package (`transforms/<county>/transform-v2.zip`)
- Output: `transformed.zip` with `data/property.json`, `data/address.json`, `data/relationship_*.json`, etc.
- Must preserve unmapped fields in `source_payload`

**5. Validate**
Check against Lexicon schema and evidence rules.
- `elephant-cli validate` on every transformed ZIP
- Fail-closed: invalid parcels are EXCLUDED, never loaded
- `ready.json` marker written only after validation passes

**6. Hash**
Canonical bundle is serialized deterministically (RFC 8785) and hashed.
- CID v1, raw codec, SHA-256
- Local pre-computation with `ipfs-only-hash`

**7. Upload**
Data uploaded to IPFS (via Filebase S3 API), producing CIDs.
- Resumable with checkpoint files
- Concurrency-safe upload (per-command middleware, not shared client)

**8. Submit**
Oracle submits hash/CID commitment to consensus smart contract on Polygon.
- `elephant-cli submit-to-contract`
- Contract compares with other oracle submissions

**9. Token Issuance**
Once consensus is reached, MAHOUT and vMAHOUT are distributed.

### Consensus Requirements by Group Type

| Group | Oracles Required | Validation Model | Reward Split |
|---|---:|---|---|
| Seed | 3 | Matching canonical hashes | 80% / 15% / 5% (by submission order) |
| County | 3 | Matching canonical hashes + freshness heartbeat | 80% / 15% / 5% |
| Photo | 1 | Provider reputation + evidence | 100% to provider |

**How consensus works**: Each oracle independently obtains source data, applies extraction/transformation, produces canonical output, hashes it, and submits the hash. Three matching hashes constitute consensus. This is **content/hash consensus**, not voting.

### Property Fact Groups

A property requires **20 validated data groups** for complete MAHOUT issuance. Major allocation:

| Group | MAHOUT Allocation |
|---|---:|
| County | 60% |
| Root (identity) | 8% |
| Photo Metadata | 15% |
| HOA | 1% |
| Remaining 16 groups | ~1% each |

Groups fall into three economic categories:
- **Consensus-based** (3 oracles, objective facts): County, Root, etc.
- **Reputation-based** (1 oracle, specialized/subjective): Photos, HOA, appraisals, inspections
- **Non-consensus** (contribution-oriented): Pay MAHOUT but don't mint vMAHOUT

---

## 5. Token Mechanics

### MAHOUT

| Property | Value |
|---|---|
| Max supply | 150,000,000 |
| Distribution | Zero presale; minted only through verified oracle contributions |
| Issuance rule | 1 MAHOUT per property after all 20 fact groups validated |
| Utility | Settlement, staking, advertising placement, protocol operations |
| Unlock condition | Oracle holds relevant vMAHOUT + service provider staked for advertising |

### vMAHOUT

| Property | Value |
|---|---|
| Transferability | Non-transferable |
| Minting | 3 vMAHOUT per completed consensus cycle (1 per participating oracle) |
| Decay | 1% per week for inactive oracles (multiplicative: `balance * 0.99^n`) |
| Purpose | Governance weight, gas-fee revenue share, data stewardship proof |
| Reassignment | Moves to newer oracle when fresher valid data replaces existing |

**Key economic insight**: MAHOUT pays for data; vMAHOUT proves who currently earns from and governs the data. An oracle can earn initial recognition but gradually loses economic and governance rights by failing to refresh its assigned data.

### Advertising/Staking Model

Service providers stake MAHOUT to advertise on property Fact Sheets. 1% of the advertising stake is slashed daily and redirected to the oracle maintaining the relevant Fact Sheet, creating recurring demand for MAHOUT and paying oracles for ongoing data maintenance.

---

## 6. MCP Integration Patterns

### The Elephant MCP Server (`elephant-xyz/elephant-mcp`)

The MCP server is **stateless**: one fresh server + transport per request. It reads data straight from public IPFS via IPNS pointers. There is no private database and no shared backend. **Anyone who wants the data deploys their own MCP** pointing at the same public IPNS name.

### MCP Tools (Open Data Path)

| Tool | Purpose |
|---|---|
| `listOracleProperties` | List properties from the sharded index (with pagination) |
| `getOracleProperty` | Fetch full consolidated record for a specific parcel |
| `getPropertyPermits` | Permit data (published IPFS or on-demand harvest if co-located) |
| `getPropertyQuerySchema` | Column names + DuckDB types + descriptions for the query table |
| `queryProperties` | Execute read-only SQL against the query table via embedded DuckDB |

### Configuration

**Minimum to serve property data**: just `ORACLE_OPEN_DATA_IPNS` (the IPNS `k51...` name).

**Multi-county**: `ORACLE_OPEN_DATA_IPNS_MAP` (JSON `{"lee":"k51...","duval":"k51..."}`) + `ORACLE_OPEN_DATA_DEFAULT_COUNTY`.

**Query table**: `PROPERTY_QUERY_TABLE_MAP` (JSON `{"duval":"https://ipfs.filebase.io/ipns/<key>"}`). The MCP opens in-process DuckDB, creates a `properties` view over the Parquet via httpfs range reads.

### How It Works

```
MCP client request (e.g., listOracleProperties {limit: 10})
    |
    v
Resolve IPNS name -> current index CID
    |
    v
Fetch index.json from IPFS gateway
    |
    v
Read shard files (shard-NNNN.json)
    |
    v
Fetch per-property JSON by CID
    |
    v
Return structured data to client
```

### Deployment Options

1. **Standalone Node HTTP**: `npm run start:http` -> `POST /mcp` endpoint
2. **Vercel**: `npm run build:vercel && vercel deploy`
3. **Cloudflare Pages**: `npx nitropack build --preset cloudflare-pages`
4. **stdio (local)**: `npx -y @elephant-xyz/mcp@latest` (for Cursor/VS Code)

### Per-Consumer Model

Every consumer runs their own MCP instance. The team's hosted MCP is just one deployment. This eliminates shared-backend dependencies and aligns with the protocol's decentralized design.

---

## 7. How Our Duval Pipeline Should Align with the Protocol

### Architecture Mapping

Our Duval County pipeline implements the oracle mining flow using the established Elephant oracle skills. The mapping is:

| Protocol Step | Pipeline Implementation |
|---|---|
| Property Identification | Seed CSV at `data/seeds/duval.csv` |
| Prepare | `Parcel.process` -> `elephant-cli prepare` with Duval browser flow |
| Enrich | Transform handler adds relationships + evidence |
| Transform | `elephant-cli transform --transform-version 2` with Duval handler package |
| Validate | `elephant-cli validate` (fail-closed gate) |
| Hash | CIDv1 pre-computed locally (`ipfs-only-hash`) |
| Upload | Filebase S3 upload via `Publish` virtual object |
| Submit | IPNS re-point (for open data); on-chain submission (future) |
| Token Issuance | Protocol-level (future) |

### Infrastructure Stack

```
Docker Compose (local)
    +-- Restate 1.7 (durable workflow engine, port 8080/9070)
    +-- Postgres 16 (query DB, port 5432)

Node services process (port 9080)
    +-- CountyIngest workflow (feeder)
    +-- IngestChunk child workflows
    +-- Parcel service (prepare -> transform -> validate -> store)
    +-- PermitHarvest + PermitFeed (permits feeder)
    +-- Loader virtual object (single-writer DB merges)
    +-- Publish virtual object (export -> approve -> IPNS loop)

Filebase (external)
    +-- S3-compatible IPFS pinning
    +-- IPNS name management

DuckDB (local/portable)
    +-- Analytical queries over published Parquet
```

### Key Alignment Requirements for Duval

1. **Lexicon compliance**: All Duval transform output must pass `elephant-cli validate`. Map Duval-specific field names and use codes to Lexicon equivalents. Preserve unmapped fields in `source_payload`.

2. **Content-addressed publishing**: Use CIDv1 + raw codec + SHA-256. Pre-compute CIDs locally. Publish via Filebase with per-county buckets.

3. **IPNS stability**: Use stable IPNS pointers (`oracle-open-data-duval`, `oracle-query-table-duval`) so MCP consumers auto-get updates with zero re-config.

4. **Continuous/incremental ingestion**: The pipeline must demonstrate ongoing ingestion, not a one-shot bulk load. The `Publish` virtual object's self-scheduling tick handles incremental re-publish. Each `IngestChunk` completion triggers `Loader.load` (incremental merge), which triggers `Publish.requestPublish()`.

5. **PII gate**: Bulk PII -> public IPFS is human-gated. The `Publish` virtual object dry-runs until `Publish/<county>/approve` is called. This is durable state that survives restarts.

6. **County slug consistency**: Use `duval` as the lowercase-hyphen slug everywhere: workflow keys, artifact paths, IPNS labels, env vars, MCP map keys. The `DUVAL` uppercased form is used only in env var names (`FILEBASE_OPEN_DATA_BUCKET_DUVAL`).

7. **Source provenance**: Every record must carry provenance identifying contributing sources and collection timestamps. The `source_artifact_uri` field links back to the `transformed.zip`.

8. **MCP readiness**: Wire the Duval IPNS names into the MCP's `ORACLE_OPEN_DATA_IPNS_MAP` and `PROPERTY_QUERY_TABLE_MAP`. Verify with `listOracleProperties` and `queryProperties` smoke queries.

### Pipeline Sequence for Duval

```
1. bootstrap-oracle-infra        -- Docker stack, data dirs, DB, services
2. county-discovery              -- Duval appraiser/permit portals, sources catalog
3. county-seed-data              -- Parcel roll -> data/seeds/duval.csv
4. county-appraisal-onboarding   -- Browser flow, transform scripts, smoke test
5. validate-county-transform     -- 10-20 diverse parcels, 100% field coverage
6. county-permit-adapter         -- Duval permit portal harvester
7. county-ingest-run (pilot)     -- ~25 parcels, verify end-to-end
8. county-ingest-run (full)      -- Full county with backpressure feeder
9. sunbiz-corporate-ingest       -- FL statewide corporate data
10. bbb-harvest                  -- Contractor reputation enrichment
11. query-db-loading-matching    -- Reconcile + verify folio counts
12. county-open-data-publish     -- Export + upload + IPNS (gated)
13. county-query-table-publish   -- Parquet export + upload + IPNS + MCP wire
14. deploy-open-data-mcp         -- Add Duval to MCP IPNS maps
```

### Webhook Extension (Spec Requirement)

The spec requires webhook events after publishing. This is an extension beyond the current skills:

- After `Publish.tick` successfully re-points IPNS, send a webhook to registered consumers
- Payload: `{ ipns_pointer, run_id, county, timestamp, delta: { new, updated, removed } }`
- Retry with backoff on failure; pipeline run is still considered successful

### Delta Metadata (Spec Requirement)

The spec requires full-snapshot artifacts WITH delta metadata. The current skills publish full snapshots. We need to extend:

- Track record deltas between runs (new/updated/removed)
- Include delta metadata in published artifacts or as a sidecar
- The `Loader` watermark already tracks content-aware changes -- leverage this for delta computation

### Run History UI (Spec Requirement)

The spec requires visible pipeline run history. Restate provides:

- Web UI at `http://localhost:9070` with invocation journals and state
- `restate sql` queries over `sys_invocation` for run status
- Workflow state (`CountyIngest.chunksDone`, `Publish.approved`, `Loader.watermark_*`)

We need to build a UI layer that exposes this data to the Oracle Operator alongside source counts, deltas, and published artifact references.

---

## Sources

### Local (Skills Repository)

- `/Users/trasgofurioso/Code/elephant/skills/README.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/county-open-data-publish/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/deploy-open-data-mcp/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/county-query-table-publish/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/onboard-county/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/durable-workflow-builder/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/bootstrap-oracle-infra/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/transform-v2-builder/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/county-seed-data/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/validate-county-transform/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/query-db-loading-matching/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/county-discovery/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/county-appraisal-onboarding/SKILL.md`
- `/Users/trasgofurioso/Code/elephant/skills/skills/county-ingest-run/SKILL.md`

### Web (Perplexity Research)

- [1] https://github.com/elephant-xyz/docs/blob/main/TECH_STACK.md
- [2] https://www.elephant.xyz/litepaper
- [3] https://adamkalamchi.com/elephant-protocol/
- [4] https://elephant.xyz/whitepaper/permissionless-implementation
- [5] https://informal-home-891991.framer.app/whitepaper/staking-logic
- [6] https://github.com/elephant-xyz/elephant-cli
- [7] https://www.npmjs.com/package/@elephant-xyz/fact-sheet
- [8] https://github.com/elephant-xyz/skills
- [9] https://ipld.io/docs/intro/ecosystem/
- [10] https://filebase.com/docs/ipfs/pinning-service-api
- [11] https://docs.filebase.com/api-documentation/ipfs-rpc-api
- [12] https://atproto.com/specs/lexicon
