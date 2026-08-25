'use client';

const PIPELINE_API = process.env.NEXT_PUBLIC_PIPELINE_API_URL ?? 'https://d5sfa8vgu8mcx.cloudfront.net';

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

// ── Criteria-based search ────────────────────────────────────────────────────

export interface CriteriaFilters {
  ownership_tenure_min_years?: number;
  roof_age_max_years?: number;
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

  if (filters.roof_age_max_years != null) {
    breakdown.push({
      criterion: 'roof_age_max_years',
      met: ((property.roof_age_years as number) ?? Infinity) <= filters.roof_age_max_years,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert pipeline API response to GeoJSON FeatureCollection. */
function propertiesToGeoJSON(properties: Record<string, unknown>[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = properties
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lng as number, p.lat as number],
      },
      properties: {
        ...p,
        address_street: p.full_address ?? p.address_street ?? '',
        address_city: 'Jacksonville',
        address_zip: p.address_zip ?? '',
      },
    }));
  return { type: 'FeatureCollection', features };
}

// ── Public API (drop-in replacements for DuckDB-WASM queries) ───────────────

/**
 * No-op — pipeline API is always ready. Kept for backwards compatibility.
 */
export async function ensureReady(): Promise<unknown> {
  return {};
}

/**
 * Query all properties (default Jacksonville viewport) as GeoJSON.
 */
export async function queryProperties(): Promise<GeoJSONFeatureCollection> {
  const res = await fetch(`${PIPELINE_API}/api/properties/viewport?lat_min=30.0&lat_max=30.6&lng_min=-82.0&lng_max=-81.0&limit=1000`);
  if (!res.ok) return { type: 'FeatureCollection', features: [] };
  const data = await res.json();
  return propertiesToGeoJSON(data.properties ?? []);
}

/**
 * Query properties within geographic bounds (viewport) as GeoJSON.
 */
export async function queryPropertiesByBounds(
  bounds: { north: number; south: number; east: number; west: number },
  limit = 1000,
): Promise<GeoJSONFeatureCollection> {
  const params = new URLSearchParams({
    lat_min: bounds.south.toString(),
    lat_max: bounds.north.toString(),
    lng_min: bounds.west.toString(),
    lng_max: bounds.east.toString(),
    limit: limit.toString(),
  });
  const res = await fetch(`${PIPELINE_API}/api/properties/viewport?${params}`);
  if (!res.ok) return { type: 'FeatureCollection', features: [] };
  const data = await res.json();
  return propertiesToGeoJSON(data.properties ?? []);
}

/**
 * Query a single property by parcel_id for the detail view.
 */
export async function queryPropertyByParcelId(parcelId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${PIPELINE_API}/api/properties/${encodeURIComponent(parcelId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.property ?? null;
}

/**
 * Query properties filtered by criteria, score each result, return sorted GeoJSON.
 */
export async function queryPropertiesByCriteria(
  filters: CriteriaFilters,
  bounds?: { north: number; south: number; east: number; west: number },
): Promise<GeoJSONFeatureCollection> {
  const params = new URLSearchParams();
  if (filters.roof_age_max_years != null) params.set('roof_age_max', filters.roof_age_max_years.toString());
  if (filters.ownership_tenure_min_years != null) params.set('ownership_min', filters.ownership_tenure_min_years.toString());
  if (filters.assessed_value_min != null) params.set('value_min', filters.assessed_value_min.toString());
  if (filters.assessed_value_max != null) params.set('value_max', filters.assessed_value_max.toString());
  if (filters.zip_codes?.length) params.set('zip', filters.zip_codes.join(','));
  if (filters.is_regional_owner) params.set('regional_owner', 'true');
  if (filters.water_proximity_max_ft != null) params.set('water_proximity', 'true');
  if (bounds) {
    params.set('lat_min', bounds.south.toString());
    params.set('lat_max', bounds.north.toString());
    params.set('lng_min', bounds.west.toString());
    params.set('lng_max', bounds.east.toString());
  }
  params.set('limit', '1000');

  const res = await fetch(`${PIPELINE_API}/api/properties/filter?${params}`);
  if (!res.ok) return { type: 'FeatureCollection', features: [] };
  const data = await res.json();
  const geojson = propertiesToGeoJSON(data.properties ?? []);

  // Score each property against criteria
  geojson.features = geojson.features.map((f) => {
    const match = evaluateMatch(f.properties, filters);
    return {
      ...f,
      properties: { ...f.properties, match_score: match.percentage, match_breakdown: match.breakdown },
    };
  });
  geojson.features.sort((a, b) => (b.properties.match_score as number) - (a.properties.match_score as number));

  return geojson;
}
