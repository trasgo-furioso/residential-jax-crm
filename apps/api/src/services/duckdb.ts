import { resolveQueryTableUrl } from '@/services/ipfs.js';
import { writeFileSync, existsSync } from 'fs';
// duckdb is a native CJS addon provided by a Lambda Layer (tobilg/duckdb-nodejs-layer).
// Lazy-loaded to avoid crashes if the layer is missing (e.g. local dev without duckdb).
let duckdb: any = null;
let duckdbLoadFailed = false;

function loadDuckDB(): any {
  if (duckdb) return duckdb;
  if (duckdbLoadFailed) return null;
  try {
    // esbuild externalises 'duckdb'; the Lambda Layer provides it at /opt/nodejs/node_modules/duckdb
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    duckdb = require('duckdb');
    return duckdb;
  } catch (err) {
    duckdbLoadFailed = true;
    console.error('[duckdb] Failed to load native duckdb module:', err);
    return null;
  }
}

// ── Module-scope singletons (reused across warm Lambda invocations) ──────────
let db: any = null;
let conn: any = null;
let initialized = false;
let currentParquetUrl: string | null = null;

const PARQUET_PATH = '/tmp/query-table.parquet';

function getConnection(): any {
  const mod = loadDuckDB();
  if (!mod) return null;
  if (!db) {
    db = new mod.Database(':memory:');
  }
  if (!conn) {
    conn = db.connect();
  }
  return conn;
}

function runQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = getConnection();
  if (!c) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    c.all(sql, ...params, (err: Error | null, rows: any) => {
      if (err) reject(err);
      else resolve((rows ?? []) as T[]);
    });
  });
}

function runExec(sql: string): Promise<void> {
  const c = getConnection();
  if (!c) return Promise.resolve();
  return new Promise((resolve, reject) => {
    c.exec(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Download the Parquet file from IPFS gateway to /tmp.
 */
async function downloadParquet(url: string): Promise<boolean> {
  try {
    console.log(`[duckdb] Downloading Parquet from ${url}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      console.error(`[duckdb] Failed to download Parquet: ${response.status} ${response.statusText}`);
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(PARQUET_PATH, buffer);
    console.log(`[duckdb] Downloaded Parquet (${(buffer.length / 1024 / 1024).toFixed(1)} MB) to ${PARQUET_PATH}`);
    return true;
  } catch (err) {
    console.error('[duckdb] Error downloading Parquet:', err);
    return false;
  }
}

/**
 * Download Parquet from IPFS to /tmp and create a VIEW over it.
 *
 * Resolves the Parquet URL from IPNS index.json (cached 5 min).
 * Returns false if the query table URL cannot be resolved (graceful degradation).
 */
async function ensureInitialized(): Promise<boolean> {
  if (initialized && currentParquetUrl && existsSync(PARQUET_PATH)) return true;

  // Bail out early if the native duckdb module is not available
  if (!loadDuckDB()) return false;

  const parquetUrl = await resolveQueryTableUrl();
  if (!parquetUrl) {
    console.warn('[duckdb] Could not resolve query table URL from IPNS — returning empty results');
    return false;
  }

  // Re-download if URL changed or file missing
  if (parquetUrl !== currentParquetUrl || !existsSync(PARQUET_PATH)) {
    const ok = await downloadParquet(parquetUrl);
    if (!ok) return false;
    currentParquetUrl = parquetUrl;
  }

  // Create/replace the view pointing at the local file
  await runExec(`CREATE OR REPLACE VIEW properties AS SELECT *, street AS address_street FROM read_parquet('${PARQUET_PATH}')`);

  initialized = true;
  return true;
}

export interface PropertyRow {
  parcel_id: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  assessed_value: number;
  market_value: number;
  current_owner_name: string;
  lat: number;
  lng: number;
  year_built: number;
  sqft: number;
  roof_age_years: number;
  ownership_tenure_years: number;
  is_regional_owner: boolean;
  water_proximity_ft: number;
  transit_distance_mi: number;
  provenance_sources: string;
  provenance_last_run: string;
  provenance_timestamps: string;
}

/**
 * Return all properties from the Parquet query table.
 */
export async function queryProperties(): Promise<PropertyRow[]> {
  const ready = await ensureInitialized();
  if (!ready) return [];
  return runQuery<PropertyRow>('SELECT * FROM properties');
}

export interface PropertyFilters {
  min_assessed_value?: number;
  max_assessed_value?: number;
  min_market_value?: number;
  max_market_value?: number;
  city?: string;
  zip?: string;
  min_year_built?: number;
  max_year_built?: number;
  min_sqft?: number;
  max_sqft?: number;
  min_roof_age_years?: number;
  max_roof_age_years?: number;
  min_ownership_tenure_years?: number;
  is_regional_owner?: boolean;
  max_water_proximity_ft?: number;
  max_transit_distance_mi?: number;
  owner_name_like?: string;
}

/**
 * Query properties with dynamic WHERE clause built from the given filters.
 */
export async function queryPropertiesByCriteria(filters: PropertyFilters): Promise<PropertyRow[]> {
  const ready = await ensureInitialized();
  if (!ready) return [];

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.min_assessed_value !== undefined) {
    conditions.push('assessed_value >= ?');
    params.push(filters.min_assessed_value);
  }
  if (filters.max_assessed_value !== undefined) {
    conditions.push('assessed_value <= ?');
    params.push(filters.max_assessed_value);
  }
  if (filters.min_market_value !== undefined) {
    conditions.push('market_value >= ?');
    params.push(filters.min_market_value);
  }
  if (filters.max_market_value !== undefined) {
    conditions.push('market_value <= ?');
    params.push(filters.max_market_value);
  }
  if (filters.city !== undefined) {
    conditions.push('address_city = ?');
    params.push(filters.city);
  }
  if (filters.zip !== undefined) {
    conditions.push('address_zip = ?');
    params.push(filters.zip);
  }
  if (filters.min_year_built !== undefined) {
    conditions.push('year_built >= ?');
    params.push(filters.min_year_built);
  }
  if (filters.max_year_built !== undefined) {
    conditions.push('year_built <= ?');
    params.push(filters.max_year_built);
  }
  if (filters.min_sqft !== undefined) {
    conditions.push('sqft >= ?');
    params.push(filters.min_sqft);
  }
  if (filters.max_sqft !== undefined) {
    conditions.push('sqft <= ?');
    params.push(filters.max_sqft);
  }
  if (filters.min_roof_age_years !== undefined) {
    conditions.push('roof_age_years >= ?');
    params.push(filters.min_roof_age_years);
  }
  if (filters.max_roof_age_years !== undefined) {
    conditions.push('roof_age_years <= ?');
    params.push(filters.max_roof_age_years);
  }
  if (filters.min_ownership_tenure_years !== undefined) {
    conditions.push('ownership_tenure_years >= ?');
    params.push(filters.min_ownership_tenure_years);
  }
  if (filters.is_regional_owner !== undefined) {
    conditions.push('is_regional_owner = ?');
    params.push(filters.is_regional_owner);
  }
  if (filters.max_water_proximity_ft !== undefined) {
    conditions.push('water_proximity_ft <= ?');
    params.push(filters.max_water_proximity_ft);
  }
  if (filters.max_transit_distance_mi !== undefined) {
    conditions.push('transit_distance_mi <= ?');
    params.push(filters.max_transit_distance_mi);
  }
  if (filters.owner_name_like !== undefined) {
    conditions.push("current_owner_name ILIKE ?");
    params.push(`%${filters.owner_name_like}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM properties ${where}`;

  return runQuery<PropertyRow>(sql, params);
}

/**
 * Execute a raw WHERE clause against the properties view.
 * Used by the AI agent to run LLM-generated filters.
 * The caller MUST sanitize the clause before passing it here.
 */
export async function queryPropertiesWithWhere(
  whereClause: string,
  limit: number = 20,
): Promise<PropertyRow[]> {
  const ready = await ensureInitialized();
  if (!ready) return [];
  const sql = `SELECT * FROM properties WHERE ${whereClause} LIMIT ${Math.min(limit, 200)}`;
  return runQuery<PropertyRow>(sql);
}
