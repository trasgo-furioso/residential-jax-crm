const FILEBASE_GATEWAY = 'https://ipfs.filebase.io';

function getIpnsKey(envVar: string): string {
  const key = process.env[envVar];
  if (!key) {
    throw new Error(`Missing environment variable: ${envVar}`);
  }
  return key;
}

/**
 * Returns the base URL for open data under the given IPNS key.
 */
export function getOpenDataUrl(
  ipnsKey: string = getIpnsKey('IPNS_OPEN_DATA_KEY'),
): string {
  return `${FILEBASE_GATEWAY}/ipns/${ipnsKey}/`;
}

// ── IPNS → index.json resolution with caching ─────────────────────────────

interface IndexJson {
  query_table_cid?: string;
  query_table_url?: string;
  [key: string]: unknown;
}

let cachedQueryTableUrl: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolves the IPNS key to fetch index.json, extracts the query_table_cid
 * or query_table_url, and returns the Parquet URL.
 *
 * Caches the resolved URL for 5 minutes to avoid re-resolving on every query.
 * Returns null if index.json is unreachable or query_table_cid is missing.
 */
export async function resolveQueryTableUrl(
  ipnsKey: string = getIpnsKey('IPNS_QUERY_TABLE_KEY'),
): Promise<string | null> {
  const now = Date.now();
  if (cachedQueryTableUrl && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedQueryTableUrl;
  }

  try {
    const indexUrl = `${FILEBASE_GATEWAY}/ipns/${ipnsKey}/index.json`;
    const response = await fetch(indexUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      console.warn(`[ipfs] Failed to fetch index.json: ${response.status} ${response.statusText}`);
      return cachedQueryTableUrl ?? null;
    }

    const index: IndexJson = (await response.json()) as IndexJson;

    // Prefer query_table_url (full URL), fall back to constructing from CID
    let url: string | null = null;
    if (index.query_table_url) {
      url = index.query_table_url;
    } else if (index.query_table_cid) {
      url = `${FILEBASE_GATEWAY}/ipfs/${index.query_table_cid}`;
    }

    if (url) {
      cachedQueryTableUrl = url;
      cacheTimestamp = now;
      return url;
    }

    // query_table_cid not yet present — gracefully return null
    console.warn('[ipfs] index.json missing query_table_cid and query_table_url');
    return cachedQueryTableUrl ?? null;
  } catch (err) {
    console.warn('[ipfs] Error resolving index.json', err);
    // Return stale cache if available
    return cachedQueryTableUrl ?? null;
  }
}

/**
 * Returns the Parquet query table URL for Duval County.
 * @deprecated Use resolveQueryTableUrl() for IPNS-based resolution.
 */
export function getQueryTableUrl(
  ipnsKey: string = getIpnsKey('IPNS_QUERY_TABLE_KEY'),
): string {
  return `${FILEBASE_GATEWAY}/ipns/${ipnsKey}/query-tables/duval/query-table.parquet`;
}

/**
 * Returns the delta JSON URL for the given IPNS key.
 */
export function getDeltaUrl(
  ipnsKey: string = getIpnsKey('IPNS_QUERY_TABLE_KEY'),
): string {
  return `${FILEBASE_GATEWAY}/ipns/${ipnsKey}/delta.json`;
}
