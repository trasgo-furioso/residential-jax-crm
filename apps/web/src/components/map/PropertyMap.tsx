'use client';

import { useRef, useCallback, useState } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import type { GeoJSONFeatureCollection } from '@/lib/duckdb';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const JACKSONVILLE_CENTER = {
  longitude: -81.6557,
  latitude: 30.3322,
  zoom: 15,
};

interface PropertyMapProps {
  properties: GeoJSONFeatureCollection;
  onPropertySelect?: (parcelId: string) => void;
  selectedParcelId?: string | null;
  matchScores?: boolean;
  mapRefCallback?: (ref: MapRef | null) => void;
  onSearchArea?: (bounds: ViewportBounds) => void;
  showSearchButton?: boolean;
  loading?: boolean;
  onMapMoved?: () => void;
  onMapLoad?: (bounds: ViewportBounds) => void;
}

export default function PropertyMap({
  properties,
  onPropertySelect,
  selectedParcelId,
  matchScores,
  mapRefCallback,
  onSearchArea,
  showSearchButton,
  loading,
  onMapMoved,
  onMapLoad,
}: PropertyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const handleMapRef = useCallback(
    (instance: MapRef | null) => {
      (mapRef as React.MutableRefObject<MapRef | null>).current = instance;
      mapRefCallback?.(instance);
    },
    [mapRefCallback],
  );

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const features = event.features;
      if (!features || features.length === 0) return;

      const feature = features[0];

      // Handle cluster click -- zoom in
      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id as number;
        const source = mapRef.current?.getSource('properties') as
          | maplibregl.GeoJSONSource
          | undefined;
        if (source) {
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            const geometry = feature.geometry as GeoJSON.Point;
            mapRef.current?.easeTo({
              center: geometry.coordinates as [number, number],
              zoom,
            });
          });
        }
        return;
      }

      // Individual property click
      const parcelId = feature.properties?.parcel_id as string | undefined;
      if (parcelId && onPropertySelect) {
        onPropertySelect(parcelId);
      }
    },
    [onPropertySelect],
  );

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !onMapLoad) return;
    const bounds = map.getBounds();
    onMapLoad({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onMapLoad]);

  const handleMoveEnd = useCallback(() => {
    // Skip the initial map load — only react to user-initiated moves
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    onMapMoved?.();
  }, [isInitialLoad, onMapMoved]);

  const handleSearchArea = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !onSearchArea) return;
    const bounds = map.getBounds();
    onSearchArea({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onSearchArea]);

  // Color expression: when match scores are available, color by score
  const circleColor = matchScores
    ? [
        'case',
        ['==', ['get', 'parcel_id'], selectedParcelId ?? ''],
        '#e55e5e',
        ['>=', ['coalesce', ['get', 'match_score'], 0], 80],
        '#22c55e',
        ['>=', ['coalesce', ['get', 'match_score'], 0], 50],
        '#eab308',
        '#ef4444',
      ]
    : [
        'case',
        ['==', ['get', 'parcel_id'], selectedParcelId ?? ''],
        '#e55e5e',
        '#3b82f6',
      ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#3b82f6',
            backgroundColor: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: '2px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Loading...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : showSearchButton ? (
        <button
          onClick={handleSearchArea}
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#3b82f6',
            backgroundColor: '#ffffff',
            border: 'none',
            borderRadius: 20,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          <span role="img" aria-label="search">&#x1F50D;</span> Search this area
        </button>
      ) : null}
      <Map
        ref={handleMapRef}
        initialViewState={JACKSONVILLE_CENTER}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        onClick={handleClick}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
      >
        <NavigationControl position="top-right" />

        <Source
          id="properties"
          type="geojson"
          data={properties}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          {/* Cluster circles */}
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                '#51bbd6',
                10,
                '#f1f075',
                50,
                '#f28cb1',
                200,
                '#e55e5e',
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                18,
                10,
                24,
                50,
                32,
                200,
                40,
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />

          {/* Cluster count label */}
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 12,
            }}
            paint={{
              'text-color': '#333333',
            }}
          />

          {/* Individual property markers */}
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': circleColor as maplibregl.ExpressionSpecification,
              'circle-radius': [
                'case',
                ['==', ['get', 'parcel_id'], selectedParcelId ?? ''],
                9,
                6,
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
