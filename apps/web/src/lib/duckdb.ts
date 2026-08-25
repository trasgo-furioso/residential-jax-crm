'use client';

import type * as duckdbWasm from '@duckdb/duckdb-wasm';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _dbInstance: duckdbWasm.AsyncDuckDB | null = null;
let connInstance: duckdbWasm.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdbWasm.AsyncDuckDBConnection> | null = null;
let resolvedParquetUrl: string | null = null;
let ipnsResolveTimestamp = 0;
const IPNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface IndexJson {
  query_table_cid?: string;
  query_table_url?: string;
  [key: string]: unknown;
}

/**
 * Guard: ensure a URL is safe for data fetching (not the CRM's own domain or
 * an unexpected domain that could hijack navigation).
 * Only allow IPFS gateways, Filebase, and known API domains.
 */
function isSafeDataUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const safeHosts = [
      'ipfs.filebase.io',
      's3.filebase.io',
      'cloudflare-ipfs.com',
      'gateway.pinata.cloud',
      'dweb.link',
    ];
    return safeHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
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

  // Primary: fetch from tRPC API which resolves IPNS server-side (fast, no browser gateway timeout)
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      console.info('[duckdb] Resolving IPNS via API...');
      const response = await fetch(`${apiUrl}/properties.getQueryTableUrl`, {
        signal: AbortSignal.timeout(10_000),
        redirect: 'error', // prevent following redirects to unexpected domains
      });
      if (response.ok) {
        const data = await response.json();
        const url = data?.result?.data?.url;
        if (url && isSafeDataUrl(url)) {
          resolvedParquetUrl = url;
          ipnsResolveTimestamp = now;
          console.info('[duckdb] Parquet URL from API:', url);
          return url;
        }
        if (url) {
          console.warn('[duckdb] API returned unsafe Parquet URL, ignoring:', url);
        }
      }
    }
  } catch (err) {
    console.warn('[duckdb] API resolution failed, trying IPNS gateway fallback:', err instanceof Error ? err.message : err);
  }

  // Fallback: direct IPNS gateway resolution (slow from browsers, 3s timeout)
  try {
    console.info('[duckdb] Falling back to IPNS gateway:', ipnsKey);
    const indexUrl = `https://ipfs.filebase.io/ipns/${ipnsKey}`;
    const response = await fetch(indexUrl, {
      signal: AbortSignal.timeout(3_000),
      redirect: 'error', // prevent following redirects to unexpected domains
    });
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

      if (url && isSafeDataUrl(url)) {
        resolvedParquetUrl = url;
        ipnsResolveTimestamp = now;
        console.info('[duckdb] Parquet URL from IPNS fallback:', url);
        return url;
      }
      if (url) {
        console.warn('[duckdb] IPNS returned unsafe Parquet URL, ignoring:', url);
      } else {
        console.warn('[duckdb] index.json missing query_table_cid and query_table_url');
      }
    }
  } catch (err) {
    console.warn('[duckdb] IPNS gateway fallback also failed:', err instanceof Error ? err.message : err);
  }

  return resolvedParquetUrl ?? null;
}

async function initDuckDB(): Promise<duckdbWasm.AsyncDuckDBConnection> {
  if (connInstance) return connInstance;

  // Dynamic import to avoid SSR issues with WASM
  const duckdb = await import('@duckdb/duckdb-wasm');

  const logger = new duckdb.ConsoleLogger();

  // Use jsdelivr bundles but construct worker via Blob URL to avoid CORS
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // Fetch the worker script as text and create a same-origin Blob URL
  const workerScriptResponse = await fetch(bundle.mainWorker!);
  const workerScriptText = await workerScriptResponse.text();
  const workerBlob = new Blob([workerScriptText], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  _dbInstance = db;
  connInstance = await db.connect();

  // Load httpfs for remote Parquet access
  await connInstance.query("INSTALL httpfs; LOAD httpfs;");

  return connInstance;
}

/**
 * Ensure DuckDB is initialized and the Parquet URL is resolved.
 * Does NOT create a VIEW — queries use read_parquet() directly with LIMIT
 * so DuckDB-WASM can leverage HTTP range requests (lazy loading).
 */
export async function ensureReady(): Promise<{ conn: duckdbWasm.AsyncDuckDBConnection; url: string } | null> {
  const url = await resolveParquetUrl();
  if (!url) {
    console.warn('[duckdb] Could not resolve query table URL from IPNS — returning empty data');
    return null;
  }
  const conn = await getConnection();
  return { conn, url };
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
  const ready = await ensureReady();
  if (!ready) return { type: 'FeatureCollection', features: [] };
  const { conn, url } = ready;
  // Query read_parquet() directly — DuckDB-WASM uses HTTP range requests to
  // fetch only the Parquet footer + needed row groups, NOT the entire file.
  const result = await conn.query(`SELECT *, street AS address_street FROM read_parquet('${url}') WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 5000`);
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
  const ready = await ensureReady();
  if (!ready) return null;
  const { conn, url } = ready;
  const result = await conn.query(`SELECT *, street AS address_street FROM read_parquet('${url}') WHERE parcel_id = '${parcelId.replace(/'/g, "''")}'`);
  const rows = result.toArray().map((row: Record<string, unknown>) => ({ ...row }));
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Query properties within geographic bounds (viewport) and return as GeoJSON.
 */
export async function queryPropertiesByBounds(
  bounds: { north: number; south: number; east: number; west: number },
  limit = 5000,
): Promise<GeoJSONFeatureCollection> {
  const ready = await ensureReady();
  if (!ready) return { type: 'FeatureCollection', features: [] };
  const { conn, url } = ready;

  const sql = `SELECT *, street AS address_street FROM read_parquet('${url}') WHERE lat BETWEEN ${bounds.south} AND ${bounds.north} AND lng BETWEEN ${bounds.west} AND ${bounds.east} LIMIT ${limit}`;
  const result = await conn.query(sql);
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

  return { type: 'FeatureCollection', features };
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
  const ready = await ensureReady();
  if (!ready) return { type: 'FeatureCollection', features: [] };
  const { conn, url } = ready;

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
  // Query read_parquet() directly with LIMIT — lazy loading via HTTP range requests
  const sql = `SELECT *, street AS address_street FROM read_parquet('${url}') ${where} LIMIT 1000`;
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
