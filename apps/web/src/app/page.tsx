'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { GeoJSONFeatureCollection, CriteriaFilters } from '@/lib/duckdb';
import type { ViewportBounds } from '@/components/map/PropertyMap';
import type { MapRef } from 'react-map-gl/maplibre';

const PropertyMap = dynamic(() => import('@/components/map/PropertyMap'), { ssr: false });
const PropertyList = dynamic(() => import('@/components/properties/PropertyList'), { ssr: false });
const PropertyDetail = dynamic(() => import('@/components/properties/PropertyDetail'), { ssr: false });
const SearchCriteria = dynamic(() => import('@/components/properties/SearchCriteria'), { ssr: false });
const DrawControl = dynamic(() => import('@/components/map/DrawControl'), { ssr: false });
const StalenessWarning = dynamic(() => import('@/components/map/StalenessWarning'), { ssr: false });

type ViewMode = 'split' | 'map' | 'list';

interface PropertyRow {
  parcel_id: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  assessed_value: number;
  market_value: number;
  current_owner_name: string;
  year_built: number;
  sqft: number;
  roof_age_years: number;
  ownership_tenure_years: number;
  is_regional_owner: boolean;
  water_proximity_ft: number;
  transit_distance_mi: number;
  lat: number;
  lng: number;
  provenance_sources: string;
  provenance_last_run: string;
  provenance_timestamps: string;
  match_score?: number;
}

const EMPTY_GEOJSON: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const toggleBtnBase: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid #d1d5db',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

function ToggleButton({
  label,
  active,
  onClick,
  position,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  position: 'left' | 'center' | 'right';
}) {
  const borderRadius =
    position === 'left'
      ? '6px 0 0 6px'
      : position === 'right'
        ? '0 6px 6px 0'
        : '0';

  return (
    <button
      onClick={onClick}
      style={{
        ...toggleBtnBase,
        borderRadius,
        backgroundColor: active ? '#3b82f6' : '#ffffff',
        color: active ? '#ffffff' : '#374151',
        borderColor: active ? '#3b82f6' : '#d1d5db',
      }}
    >
      {label}
    </button>
  );
}

function MatchScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 80 ? '#dcfce7' : score >= 50 ? '#fef9c3' : '#fee2e2';
  const color =
    score >= 80 ? '#166534' : score >= 50 ? '#854d0e' : '#dc2626';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 10,
        backgroundColor: bg,
        color,
        minWidth: 32,
        textAlign: 'center',
      }}
    >
      {score}%
    </span>
  );
}

function featureToRow(f: GeoJSONFeatureCollection['features'][number]): PropertyRow {
  return {
    parcel_id: f.properties.parcel_id as string,
    address_street: f.properties.address_street as string,
    address_city: f.properties.address_city as string,
    address_zip: f.properties.address_zip as string,
    assessed_value: f.properties.assessed_value as number,
    market_value: f.properties.market_value as number,
    current_owner_name: f.properties.current_owner_name as string,
    year_built: f.properties.year_built as number,
    sqft: f.properties.sqft as number,
    roof_age_years: f.properties.roof_age_years as number,
    ownership_tenure_years: f.properties.ownership_tenure_years as number,
    is_regional_owner: f.properties.is_regional_owner as boolean,
    water_proximity_ft: f.properties.water_proximity_ft as number,
    transit_distance_mi: f.properties.transit_distance_mi as number,
    lat: (f.geometry.coordinates as [number, number])[1],
    lng: (f.geometry.coordinates as [number, number])[0],
    provenance_sources: (f.properties.provenance_sources as string) ?? '',
    provenance_last_run: (f.properties.provenance_last_run as string) ?? '',
    provenance_timestamps: (f.properties.provenance_timestamps as string) ?? '',
    match_score: f.properties.match_score as number | undefined,
  };
}

export default function Dashboard() {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection>(EMPTY_GEOJSON);
  const [allGeojson, setAllGeojson] = useState<GeoJSONFeatureCollection>(EMPTY_GEOJSON);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<CriteriaFilters | null>(null);
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [lastLoadTime, setLastLoadTime] = useState<number | null>(null);
  const mapRefHolder = useRef<MapRef | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const handleMapRefCallback = useCallback((instance: MapRef | null) => {
    mapRefHolder.current = instance;
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setLoadFailed(false);
        const { queryProperties } = await import('@/lib/duckdb');
        const data = await queryProperties();
        if (cancelled) return;

        setAllGeojson(data);
        setGeojson(data);
        setProperties(data.features.map(featureToRow));
        setLastLoadTime(Date.now());
        setLoadFailed(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load properties');
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePropertySelect = useCallback((parcelId: string) => {
    setSelectedParcelId((prev) => (prev === parcelId ? null : parcelId));
  }, []);

  const selectedProperty = useMemo(() => {
    if (!selectedParcelId) return null;
    return properties.find((p) => p.parcel_id === selectedParcelId) ?? null;
  }, [selectedParcelId, properties]);

  // Apply criteria search via client-side DuckDB
  const handleApplyCriteria = useCallback(async (filters: CriteriaFilters) => {
    // Check if any filter is actually set
    const hasFilters = Object.values(filters).some((v) => {
      if (v == null) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    });

    if (!hasFilters) {
      // No filters, show all
      setGeojson(allGeojson);
      setProperties(allGeojson.features.map(featureToRow));
      setActiveFilters(null);
      return;
    }

    setSearching(true);
    setActiveFilters(filters);
    try {
      const { queryPropertiesByCriteria } = await import('@/lib/duckdb');
      const data = await queryPropertiesByCriteria(filters);

      // If geographic bounds drawn, filter by bounding box
      let filtered = data;
      if (drawnGeometry && drawnGeometry.type === 'Polygon') {
        const coords = drawnGeometry.coordinates[0];
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        filtered = {
          ...data,
          features: data.features.filter((f) => {
            const [lng, lat] = f.geometry.coordinates;
            return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
          }),
        };
      }

      setGeojson(filtered);
      setProperties(filtered.features.map(featureToRow));
    } catch (err) {
      console.error('Criteria search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [allGeojson, drawnGeometry]);

  const handleClearCriteria = useCallback(() => {
    setActiveFilters(null);
    setGeojson(allGeojson);
    setProperties(allGeojson.features.map(featureToRow));
  }, [allGeojson]);

  const handleGeometryChange = useCallback((geometry: GeoJSON.Geometry | null) => {
    setDrawnGeometry(geometry);
  }, []);

  const handleRetryLoad = useCallback(async () => {
    try {
      const { queryProperties } = await import('@/lib/duckdb');
      const data = await queryProperties();
      setAllGeojson(data);
      setGeojson(data);
      setProperties(data.features.map(featureToRow));
      setLastLoadTime(Date.now());
      setLoadFailed(false);
      setError(null);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  const handleMapMoved = useCallback(() => {
    setMapMoved(true);
  }, []);

  const handleSearchArea = useCallback(async (bounds: ViewportBounds) => {
    setSearching(true);
    setMapMoved(false);
    try {
      const { queryPropertiesByBounds } = await import('@/lib/duckdb');
      let data = await queryPropertiesByBounds(bounds);

      // If criteria filters are active, apply scoring to the bounded results
      if (activeFilters) {
        const { evaluateMatch } = await import('@/lib/duckdb');
        const scored: GeoJSONFeatureCollection = {
          ...data,
          features: data.features.map((f) => {
            const match = evaluateMatch(f.properties, activeFilters);
            return {
              ...f,
              properties: { ...f.properties, match_score: match.percentage, match_breakdown: match.breakdown },
            };
          }),
        };
        scored.features.sort(
          (a, b) => (b.properties.match_score as number) - (a.properties.match_score as number),
        );
        data = scored;
      }

      setGeojson(data);
      setProperties(data.features.map(featureToRow));
    } catch (err) {
      console.error('Search area failed:', err);
    } finally {
      setSearching(false);
    }
  }, [activeFilters]);

  const showMap = viewMode === 'split' || viewMode === 'map';
  const showList = viewMode === 'split' || viewMode === 'list';

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 48px)',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Initializing DuckDB and loading property data...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 48px)',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>
          Error loading properties
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 400, textAlign: 'center' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 48px)',
        gap: 0,
      }}
    >
      {/* Staleness warning banner */}
      <StalenessWarning
        loadFailed={loadFailed}
        lastLoadTime={lastLoadTime}
        onRetry={handleRetryLoad}
      />

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 0 12px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>
            Property Discovery
          </h1>
          {activeFilters && (
            <span
              style={{
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                borderRadius: 10,
              }}
            >
              Filtered: {properties.length.toLocaleString()} results
            </span>
          )}
          {searching && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>Searching...</span>
          )}
        </div>
        <div style={{ display: 'flex' }}>
          <ToggleButton
            label="Map Only"
            active={viewMode === 'map'}
            onClick={() => setViewMode('map')}
            position="left"
          />
          <ToggleButton
            label="Split"
            active={viewMode === 'split'}
            onClick={() => setViewMode('split')}
            position="center"
          />
          <ToggleButton
            label="List Only"
            active={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            position="right"
          />
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 12,
          minHeight: 0,
        }}
      >
        {/* Map panel */}
        {showMap && (
          <div
            style={{
              flex: viewMode === 'map' ? 1 : 3,
              minWidth: viewMode === 'split' ? '55%' : undefined,
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
              position: 'relative',
            }}
          >
            <PropertyMap
              properties={geojson}
              onPropertySelect={handlePropertySelect}
              selectedParcelId={selectedParcelId}
              matchScores={activeFilters != null}
              mapRefCallback={handleMapRefCallback}
              onSearchArea={handleSearchArea}
              showSearchButton={mapMoved}
              onMapMoved={handleMapMoved}
            />
            <DrawControl
              mapRef={mapRefHolder}
              onGeometryChange={handleGeometryChange}
            />
          </div>
        )}

        {/* Right panel: search + detail + list */}
        {(showList || selectedProperty) && (
          <div
            style={{
              flex: viewMode === 'list' ? 1 : 2,
              maxWidth: viewMode === 'split' ? '45%' : undefined,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            {/* Search Criteria panel */}
            <SearchCriteria onApply={handleApplyCriteria} onClear={handleClearCriteria} />

            {/* Detail panel (when a property is selected) */}
            {selectedProperty && (
              <div
                style={{
                  flexShrink: 0,
                  maxHeight: selectedProperty && showList ? '35%' : '100%',
                  overflowY: 'auto',
                }}
              >
                <PropertyDetail
                  property={selectedProperty}
                  onClose={() => setSelectedParcelId(null)}
                />
                {selectedProperty.match_score != null && (
                  <div
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '0 0 8px 8px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      marginTop: -8,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginRight: 8 }}>
                      Match Score:
                    </span>
                    <MatchScoreBadge score={selectedProperty.match_score} />
                  </div>
                )}
              </div>
            )}

            {/* List */}
            {showList && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <PropertyList
                  properties={properties}
                  onPropertySelect={handlePropertySelect}
                  selectedParcelId={selectedParcelId}
                  showMatchScore={activeFilters != null}
                  viewMode={viewMode === 'split' ? 'split' : 'list'}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
