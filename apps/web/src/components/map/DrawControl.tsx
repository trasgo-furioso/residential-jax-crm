'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';

interface DrawControlProps {
  mapRef: React.RefObject<MapRef | null>;
  onGeometryChange: (geometry: GeoJSON.Geometry | null) => void;
}

type DrawMode = 'none' | 'polygon' | 'radius';

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: '#ffffff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
};

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  borderColor: '#3b82f6',
};

/**
 * Simple draw control for polygon and radius (circle) drawing on MapLibre.
 * Uses direct canvas/map event listeners instead of requiring @mapbox/mapbox-gl-draw.
 */
export default function DrawControl({ mapRef, onGeometryChange }: DrawControlProps) {
  const [mode, setMode] = useState<DrawMode>('none');
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null);
  const [radiusFt, setRadiusFt] = useState<number>(0);
  const [hasShape, setHasShape] = useState(false);
  const sourceAddedRef = useRef(false);

  // Add/update the draw layer on the map
  const updateDrawLayer = useCallback(
    (geometry: GeoJSON.Geometry | null) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const geojsonData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: geometry
          ? [{ type: 'Feature', geometry, properties: {} }]
          : [],
      };

      if (!sourceAddedRef.current) {
        map.addSource('draw-source', { type: 'geojson', data: geojsonData });
        map.addLayer({
          id: 'draw-fill',
          type: 'fill',
          source: 'draw-source',
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.15,
          },
        });
        map.addLayer({
          id: 'draw-outline',
          type: 'line',
          source: 'draw-source',
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2,
          },
        });
        sourceAddedRef.current = true;
      } else {
        const source = map.getSource('draw-source');
        if (source && 'setData' in source) {
          (source as maplibregl.GeoJSONSource).setData(geojsonData);
        }
      }
    },
    [mapRef],
  );

  // Generate a circle polygon from center and radius in feet
  const makeCirclePolygon = useCallback(
    (center: [number, number], radiusFeet: number): GeoJSON.Polygon => {
      const radiusDeg = radiusFeet / 364_000; // rough ft-to-deg at ~30N latitude
      const points: [number, number][] = [];
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        points.push([
          center[0] + radiusDeg * Math.cos(angle),
          center[1] + radiusDeg * Math.sin(angle) * 0.85, // adjust for lat compression
        ]);
      }
      return { type: 'Polygon', coordinates: [points] };
    },
    [],
  );

  // Handle map clicks for polygon/radius drawing
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    function handleClick(e: maplibregl.MapMouseEvent) {
      const lngLat = e.lngLat;

      if (mode === 'polygon') {
        setPolygonPoints((prev) => {
          const next = [...prev, [lngLat.lng, lngLat.lat] as [number, number]];
          // Show interim polygon
          if (next.length >= 3) {
            const geom: GeoJSON.Polygon = {
              type: 'Polygon',
              coordinates: [[...next, next[0]]],
            };
            updateDrawLayer(geom);
          }
          return next;
        });
      } else if (mode === 'radius') {
        if (!radiusCenter) {
          setRadiusCenter([lngLat.lng, lngLat.lat]);
        }
      }
    }

    if (mode !== 'none') {
      map.on('click', handleClick);
      map.getCanvas().style.cursor = 'crosshair';
    }

    return () => {
      map.off('click', handleClick);
      map.getCanvas().style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mapRef, radiusCenter]);

  // Handle mouse move for radius preview
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || mode !== 'radius' || !radiusCenter) return;

    function handleMove(e: maplibregl.MapMouseEvent) {
      if (!radiusCenter) return;
      const dx = e.lngLat.lng - radiusCenter[0];
      const dy = e.lngLat.lat - radiusCenter[1];
      const distDeg = Math.sqrt(dx * dx + dy * dy);
      const distFt = distDeg * 364_000;
      setRadiusFt(Math.round(distFt));
      const geom = makeCirclePolygon(radiusCenter, distFt);
      updateDrawLayer(geom);
    }

    function handleClick(e: maplibregl.MapMouseEvent) {
      if (!radiusCenter) return;
      const dx = e.lngLat.lng - radiusCenter[0];
      const dy = e.lngLat.lat - radiusCenter[1];
      const distDeg = Math.sqrt(dx * dx + dy * dy);
      const distFt = distDeg * 364_000;
      const geom = makeCirclePolygon(radiusCenter, distFt);
      updateDrawLayer(geom);
      onGeometryChange(geom);
      setHasShape(true);
      setMode('none');
      setRadiusFt(Math.round(distFt));
    }

    map.on('mousemove', handleMove);
    map.on('click', handleClick);

    return () => {
      map.off('mousemove', handleMove);
      map.off('click', handleClick);
    };
  }, [mode, radiusCenter, mapRef, makeCirclePolygon, updateDrawLayer, onGeometryChange]);

  const handleStartPolygon = useCallback(() => {
    setPolygonPoints([]);
    setRadiusCenter(null);
    setMode('polygon');
    updateDrawLayer(null);
    setHasShape(false);
    onGeometryChange(null);
  }, [updateDrawLayer, onGeometryChange]);

  const handleStartRadius = useCallback(() => {
    setPolygonPoints([]);
    setRadiusCenter(null);
    setRadiusFt(0);
    setMode('radius');
    updateDrawLayer(null);
    setHasShape(false);
    onGeometryChange(null);
  }, [updateDrawLayer, onGeometryChange]);

  const handleFinishPolygon = useCallback(() => {
    if (polygonPoints.length < 3) return;
    const geom: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[...polygonPoints, polygonPoints[0]]],
    };
    updateDrawLayer(geom);
    onGeometryChange(geom);
    setHasShape(true);
    setMode('none');
  }, [polygonPoints, updateDrawLayer, onGeometryChange]);

  const handleClearDrawing = useCallback(() => {
    setMode('none');
    setPolygonPoints([]);
    setRadiusCenter(null);
    setRadiusFt(0);
    setHasShape(false);
    updateDrawLayer(null);
    onGeometryChange(null);
  }, [updateDrawLayer, onGeometryChange]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '6px 8px',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
      }}
    >
      <button
        style={mode === 'polygon' ? activeBtnStyle : btnStyle}
        onClick={handleStartPolygon}
      >
        Draw Polygon
      </button>
      <button
        style={mode === 'radius' ? activeBtnStyle : btnStyle}
        onClick={handleStartRadius}
      >
        Draw Radius
      </button>

      {mode === 'polygon' && polygonPoints.length >= 3 && (
        <button style={{ ...btnStyle, backgroundColor: '#10b981', color: '#fff', borderColor: '#10b981' }} onClick={handleFinishPolygon}>
          Finish ({polygonPoints.length} pts)
        </button>
      )}

      {mode === 'radius' && radiusCenter && (
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          {radiusFt > 0 ? `${radiusFt.toLocaleString()} ft` : 'Click to set radius'}
        </span>
      )}

      {mode === 'polygon' && !radiusCenter && (
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          Click map to add points
        </span>
      )}

      {hasShape && (
        <button
          style={{ ...btnStyle, backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}
          onClick={handleClearDrawing}
        >
          Clear Drawing
        </button>
      )}
    </div>
  );
}
