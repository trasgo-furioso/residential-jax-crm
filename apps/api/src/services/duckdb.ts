import duckdb from 'duckdb';
import type { DuckDbError, TableData } from 'duckdb';
import { resolveQueryTableUrl } from '@/services/ipfs.js';

let db: duckdb.Database | null = null;
let conn: duckdb.Connection | null = null;
let initialized = false;
let currentParquetUrl: string | null = null;

function getConnection(): duckdb.Connection {
  if (!db) {
    db = new duckdb.Database(':memory:');
  }
  if (!conn) {
    conn = db.connect();
  }
  return conn;
}

function runQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const c = getConnection();
    c.all(sql, ...params, (err: DuckDbError | null, rows: TableData) => {
      if (err) reject(err);
      else resolve((rows ?? []) as T[]);
    });
  });
}

function runExec(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const c = getConnection();
    c.exec(sql, (err: DuckDbError | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Initialize DuckDB with httpfs extension and create a VIEW over the
 * remote Parquet file served from Filebase via IPNS.
 *
 * Resolves the Parquet URL from IPNS index.json (cached).
 * Returns false if the query table URL cannot be resolved (graceful degradation).
 */
async function ensureInitialized(): Promise<boolean> {
  if (initialized && currentParquetUrl) return true;

  await runExec("INSTALL httpfs; LOAD httpfs;");

  const parquetUrl = await resolveQueryTableUrl();
  if (!parquetUrl) {
    console.warn('[duckdb] Could not resolve query table URL from IPNS — returning empty results');
    return false;
  }

  // Only recreate the view if the URL changed
  if (parquetUrl !== currentParquetUrl) {
    await runExec(`
      CREATE OR REPLACE VIEW properties AS
      SELECT * FROM read_parquet('${parquetUrl}');
    `);
    currentParquetUrl = parquetUrl;
  }

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
