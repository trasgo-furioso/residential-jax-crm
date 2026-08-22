'use client';

import type * as duckdbWasm from '@duckdb/duckdb-wasm';

let dbInstance: duckdbWasm.AsyncDuckDB | null = null;
let connInstance: duckdbWasm.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdbWasm.AsyncDuckDBConnection> | null = null;
let viewCreated = false;

function getParquetUrl(): string {
  const ipnsKey = process.env.NEXT_PUBLIC_IPNS_QUERY_TABLE;
  if (!ipnsKey) {
    throw new Error('NEXT_PUBLIC_IPNS_QUERY_TABLE environment variable is required');
  }
  return `https://ipfs.filebase.io/ipns/${ipnsKey}/query-tables/duval/query-table.parquet`;
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

  dbInstance = db;
  connInstance = await db.connect();

  // Load httpfs for remote Parquet access
  await connInstance.query("INSTALL httpfs; LOAD httpfs;");

  return connInstance;
}

async function ensureView(): Promise<duckdbWasm.AsyncDuckDBConnection> {
  const conn = await getConnection();
  if (!viewCreated) {
    const url = getParquetUrl();
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
  const result = await conn.query(`SELECT * FROM properties WHERE parcel_id = '${parcelId.replace(/'/g, "''")}'`);
  const rows = result.toArray().map((row: Record<string, unknown>) => ({ ...row }));
  return rows.length > 0 ? rows[0] : null;
}
