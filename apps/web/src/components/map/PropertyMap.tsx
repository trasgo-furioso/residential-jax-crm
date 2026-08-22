'use client';

import { useRef, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import type { GeoJSONFeatureCollection } from '@/lib/duckdb';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const JACKSONVILLE_CENTER = {
  longitude: -81.6557,
  latitude: 30.3322,
  zoom: 11,
};

interface PropertyMapProps {
  properties: GeoJSONFeatureCollection;
  onPropertySelect?: (parcelId: string) => void;
  selectedParcelId?: string | null;
  matchScores?: boolean;
  mapRefCallback?: (ref: MapRef | null) => void;
}

export default function PropertyMap({
  properties,
  onPropertySelect,
  selectedParcelId,
  matchScores,
  mapRefCallback,
}: PropertyMapProps) {
  const mapRef = useRef<MapRef>(null);

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
      <Map
        ref={handleMapRef}
        initialViewState={JACKSONVILLE_CENTER}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        onClick={handleClick}
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
