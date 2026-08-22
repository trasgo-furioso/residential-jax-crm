'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryProperties } from '@/lib/duckdb';
import type { GeoJSONFeatureCollection } from '@/lib/duckdb';
import PropertyMap from '@/components/map/PropertyMap';
import PropertyList from '@/components/properties/PropertyList';
import PropertyDetail from '@/components/properties/PropertyDetail';

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

export default function Dashboard() {
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection>(EMPTY_GEOJSON);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await queryProperties();
        if (cancelled) return;

        setGeojson(data);

        // Extract flat property rows from GeoJSON features
        const rows: PropertyRow[] = data.features.map((f) => ({
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
        }));
        setProperties(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load properties');
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
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 0 12px 0',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>
          Property Discovery
        </h1>
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
              flex: viewMode === 'map' ? 1 : 0.6,
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
            }}
          >
            <PropertyMap
              properties={geojson}
              onPropertySelect={handlePropertySelect}
              selectedParcelId={selectedParcelId}
            />
          </div>
        )}

        {/* Right panel: list + detail */}
        {(showList || selectedProperty) && (
          <div
            style={{
              flex: viewMode === 'list' ? 1 : 0.4,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
            }}
          >
            {/* Detail panel (when a property is selected) */}
            {selectedProperty && (
              <div
                style={{
                  flexShrink: 0,
                  maxHeight: selectedProperty && showList ? '45%' : '100%',
                  overflowY: 'auto',
                }}
              >
                <PropertyDetail
                  property={selectedProperty}
                  onClose={() => setSelectedParcelId(null)}
                />
              </div>
            )}

            {/* List */}
            {showList && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <PropertyList
                  properties={properties}
                  onPropertySelect={handlePropertySelect}
                  selectedParcelId={selectedParcelId}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
