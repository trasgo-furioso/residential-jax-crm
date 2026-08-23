'use client';

import type * as duckdbWasm from '@duckdb/duckdb-wasm';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _dbInstance: duckdbWasm.AsyncDuckDB | null = null;
let connInstance: duckdbWasm.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdbWasm.AsyncDuckDBConnection> | null = null;
let viewCreated = false;
let resolvedParquetUrl: string | null = null;
let ipnsResolveTimestamp = 0;
const IPNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface IndexJson {
  query_table_cid?: string;
  query_table_url?: string;
  [key: string]: unknown;
}

/**
 * Resolve IPNS key to fetch index.json, extract query_table_url or query_table_cid.
 * Caches the result for 5 minutes.
 */
async function resolveParquetUrl(): Promise<string | null> {
  const ipnsKey = process.env.NEXT_PUBLIC_IPNS_QUERY_TABLE;
  if (!ipnsKey || ipnsKey === 'placeholder') {
    console.warn('[duckdb] NEXT_PUBLIC_IPNS_QUERY_TABLE not set or placeholder');
    return null;
  }

  const now = Date.now();
  if (resolvedParquetUrl && now - ipnsResolveTimestamp < IPNS_CACHE_TTL_MS) {
    return resolvedParquetUrl;
  }

  // Try IPNS resolution with generous timeout (gateway can be slow from browsers)
  try {
    console.info('[duckdb] Resolving IPNS:', ipnsKey);
    const indexUrl = `https://ipfs.filebase.io/ipns/${ipnsKey}`;
    const response = await fetch(indexUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      console.warn(`[duckdb] IPNS fetch failed: ${response.status}`);
    } else {
      const index: IndexJson = (await response.json()) as IndexJson;
      console.info('[duckdb] Index resolved:', JSON.stringify(index));

      let url: string | null = null;
      if (index.query_table_url) {
        url = index.query_table_url;
      } else if (index.query_table_cid) {
        url = `https://ipfs.filebase.io/ipfs/${index.query_table_cid}`;
      }

      if (url) {
        resolvedParquetUrl = url;
        ipnsResolveTimestamp = now;
        console.info('[duckdb] Parquet URL resolved:', url);
        return url;
      }
      console.warn('[duckdb] index.json missing query_table_cid and query_table_url');
    }
  } catch (err) {
    console.warn('[duckdb] IPNS resolution failed, trying API fallback:', err instanceof Error ? err.message : err);
  }

  // Fallback: fetch index from the tRPC API which resolves server-side (faster, no IPNS gateway timeout)
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      console.info('[duckdb] Trying server-side IPNS resolution via API...');
      const response = await fetch(`${apiUrl}/trpc/properties.getQueryTableUrl`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const data = await response.json();
        const url = data?.result?.data?.url;
        if (url) {
          resolvedParquetUrl = url;
          ipnsResolveTimestamp = now;
          console.info('[duckdb] Parquet URL from API fallback:', url);
          return url;
        }
      }
    }
  } catch (err) {
    console.warn('[duckdb] API fallback also failed:', err instanceof Error ? err.message : err);
  }

  return resolvedParquetUrl ?? null;
}

async function initDuckDB(): Promise<duckdbWasm.AsyncDuckDBConnection> {
  if (connInstance) return connInstance;

  // Dynamic import to avoid SSR issues with WASM
  const duckdb = await import('@duckdb/duckdb-wasm');

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  _dbInstance = db;
  connInstance = await db.connect();

  // Load httpfs for remote Parquet access
  await connInstance.query("INSTALL httpfs; LOAD httpfs;");

  return connInstance;
}

async function ensureView(): Promise<duckdbWasm.AsyncDuckDBConnection | null> {
  const url = await resolveParquetUrl();
  if (!url) {
    console.warn('[duckdb] Could not resolve query table URL from IPNS — returning empty data');
    return null;
  }
  const conn = await getConnection();
  if (!viewCreated) {
    await conn.query(`
      CREATE OR REPLACE VIEW properties AS
      SELECT * FROM read_parquet('${url}');
    `);
    viewCreated = true;
  }
  return conn;
}

async function getConnection(): Promise<duckdbWasm.AsyncDuckDBConnection> {
  if (!initPromise) {
    initPromise = initDuckDB();
  }
  return initPromise;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Query all properties and return as GeoJSON FeatureCollection for MapLibre.
 */
export async function queryProperties(): Promise<GeoJSONFeatureCollection> {
  const conn = await ensureView();
  if (!conn) return { type: 'FeatureCollection', features: [] };
  const result = await conn.query('SELECT * FROM properties');
  const rows = result.toArray().map((row: Record<string, unknown>) => ({ ...row }));

  const features: GeoJSONFeature[] = rows.map((row) => {
    const { lat, lng, ...rest } = row as Record<string, unknown> & { lat: number; lng: number };
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [lng, lat],
      },
      properties: rest,
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Query a single property by parcel_id for the detail view.
 */
export async function queryPropertyByParcelId(
  parcelId: string,
): Promise<Record<string, unknown> | null> {
  const conn = await ensureView();
  if (!conn) return null;
  const result = await conn.query(`SELECT * FROM properties WHERE parcel_id = '${parcelId.replace(/'/g, "''")}'`);
  const rows = result.toArray().map((row: Record<string, unknown>) => ({ ...row }));
  return rows.length > 0 ? rows[0] : null;
}

// ── Criteria-based search (client-side DuckDB) ────────────────────────────

export interface CriteriaFilters {
  ownership_tenure_min_years?: number;
  roof_age_min_years?: number;
  zip_codes?: string[];
  assessed_value_min?: number;
  assessed_value_max?: number;
  is_regional_owner?: boolean;
  water_proximity_max_ft?: number;
}

export interface CriterionResult {
  criterion: string;
  met: boolean;
}

export interface MatchResult {
  score: number;
  total: number;
  percentage: number;
  breakdown: CriterionResult[];
}

/**
 * Client-side criteria evaluator (mirrors server-side criteria-matcher).
 */
export function evaluateMatch(
  property: Record<string, unknown>,
  filters: CriteriaFilters,
): MatchResult {
  const breakdown: CriterionResult[] = [];

  if (filters.ownership_tenure_min_years != null) {
    breakdown.push({
      criterion: 'ownership_tenure_min_years',
      met: ((property.ownership_tenure_years as number) ?? 0) >= filters.ownership_tenure_min_years,
    });
  }

  if (filters.roof_age_min_years != null) {
    breakdown.push({
      criterion: 'roof_age_min_years',
      met: ((property.roof_age_years as number) ?? 0) >= filters.roof_age_min_years,
    });
  }

  if (filters.zip_codes != null && filters.zip_codes.length > 0) {
    breakdown.push({
      criterion: 'zip_codes',
      met: filters.zip_codes.includes((property.address_zip as string) ?? ''),
    });
  }

  if (filters.assessed_value_min != null) {
    breakdown.push({
      criterion: 'assessed_value_min',
      met: ((property.assessed_value as number) ?? 0) >= filters.assessed_value_min,
    });
  }

  if (filters.assessed_value_max != null) {
    breakdown.push({
      criterion: 'assessed_value_max',
      met: ((property.assessed_value as number) ?? Infinity) <= filters.assessed_value_max,
    });
  }

  if (filters.is_regional_owner != null) {
    breakdown.push({
      criterion: 'is_regional_owner',
      met: property.is_regional_owner === true,
    });
  }

  if (filters.water_proximity_max_ft != null) {
    breakdown.push({
      criterion: 'water_proximity_max_ft',
      met: ((property.water_proximity_ft as number) ?? Infinity) <= filters.water_proximity_max_ft,
    });
  }

  const total = breakdown.length;
  const score = breakdown.filter((b) => b.met).length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return { score, total, percentage, breakdown };
}

/**
 * Query properties filtered by criteria using client-side DuckDB,
 * then score each result against the criteria.
 * Returns GeoJSON FeatureCollection with match scores in properties.
 */
export async function queryPropertiesByCriteria(
  filters: CriteriaFilters,
): Promise<GeoJSONFeatureCollection> {
  const conn = await ensureView();
  if (!conn) return { type: 'FeatureCollection', features: [] };

  const conditions: string[] = [];

  if (filters.ownership_tenure_min_years != null) {
    conditions.push(`ownership_tenure_years >= ${Number(filters.ownership_tenure_min_years)}`);
  }
  if (filters.roof_age_min_years != null) {
    conditions.push(`roof_age_years >= ${Number(filters.roof_age_min_years)}`);
  }
  if (filters.zip_codes != null && filters.zip_codes.length > 0) {
    const escaped = filters.zip_codes.map((z) => `'${z.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`address_zip IN (${escaped})`);
  }
  if (filters.assessed_value_min != null) {
    conditions.push(`assessed_value >= ${Number(filters.assessed_value_min)}`);
  }
  if (filters.assessed_value_max != null) {
    conditions.push(`assessed_value <= ${Number(filters.assessed_value_max)}`);
  }
  if (filters.is_regional_owner != null) {
    conditions.push(`is_regional_owner = ${filters.is_regional_owner}`);
  }
  if (filters.water_proximity_max_ft != null) {
    conditions.push(`water_proximity_ft <= ${Number(filters.water_proximity_max_ft)}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM properties ${where}`;
  const result = await conn.query(sql);
  const rows = result.toArray().map((row: Record<string, unknown>) => ({ ...row }));

  const features: GeoJSONFeature[] = rows.map((row) => {
    const { lat, lng, ...rest } = row as Record<string, unknown> & { lat: number; lng: number };
    const match = evaluateMatch(rest, filters);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [lng, lat],
      },
      properties: { ...rest, match_score: match.percentage, match_breakdown: match.breakdown },
    };
  });

  // Sort by match score descending
  features.sort(
    (a, b) => (b.properties.match_score as number) - (a.properties.match_score as number),
  );

  return { type: 'FeatureCollection', features };
}
