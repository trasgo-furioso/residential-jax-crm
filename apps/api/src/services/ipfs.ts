const FILEBASE_GATEWAY = 'https://ipfs.filebase.io/ipns';

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
  return `${FILEBASE_GATEWAY}/${ipnsKey}/`;
}

/**
 * Returns the Parquet query table URL for Duval County.
 */
export function getQueryTableUrl(
  ipnsKey: string = getIpnsKey('IPNS_QUERY_TABLE_KEY'),
): string {
  return `${FILEBASE_GATEWAY}/${ipnsKey}/query-tables/duval/query-table.parquet`;
}

/**
 * Returns the delta JSON URL for the given IPNS key.
 */
export function getDeltaUrl(
  ipnsKey: string = getIpnsKey('IPNS_QUERY_TABLE_KEY'),
): string {
  return `${FILEBASE_GATEWAY}/${ipnsKey}/delta.json`;
}
