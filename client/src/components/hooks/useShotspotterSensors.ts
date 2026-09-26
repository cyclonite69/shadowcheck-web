import { useEffect, useRef, useState } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { agencyApi } from '../../api/agencyApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

interface ShotspotterSensorFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    sensor_id: string | null;
    city: string | null;
    state: string | null;
    status: string | null;
    source: string;
  };
}

interface ShotspotterSensorsGeoJSON {
  type: 'FeatureCollection';
  features: ShotspotterSensorFeature[];
}

const SENSOR_COLOR = '#8B0000';

function renderSensorPopupCard(props: ShotspotterSensorFeature['properties']): string {
  const location = [props.city, props.state].filter(Boolean).join(', ') || 'Unknown location';
  const status = props.status || 'unknown';
  return `
    <div style="background:#1e293b;border:1px solid ${SENSOR_COLOR}44;border-radius:10px;padding:14px 16px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${SENSOR_COLOR};"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${SENSOR_COLOR};">ShotSpotter Sensor</div>
      </div>
      <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:6px;">${location}</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:2px;">Status: ${status}</div>
      <div style="font-size:12px;color:#94a3b8;">Source: ${props.source}</div>
    </div>
  `;
}

export const useShotspotterSensors = (
  mapRef: React.MutableRefObject<Map | null>,
  mapReady: boolean,
  isVisible: boolean = false,
  mapboxRef?: React.MutableRefObject<typeof mapboxglType | null>
) => {
  const [hasBeenVisible, setHasBeenVisible] = useState(isVisible);

  useEffect(() => {
    if (isVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [isVisible, hasBeenVisible]);

  const {
    data,
    loading,
    error: fetchError,
  } = useAsyncData<ShotspotterSensorsGeoJSON>(
    () =>
      hasBeenVisible
        ? agencyApi.getShotspotterSensors()
        : Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          } as ShotspotterSensorsGeoJSON),
    [hasBeenVisible]
  );
  const error = fetchError?.message ?? null;

  const dataRef = useRef<ShotspotterSensorsGeoJSON | null>(null);
  const isVisibleRef = useRef(isVisible);

  dataRef.current = data;
  isVisibleRef.current = isVisible;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data || data.features.length === 0) {
      return;
    }

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    const removeHandlers = () => {
      map.off('click', 'shotspotter-sensors-points', handleClick);
      map.off('mouseenter', 'shotspotter-sensors-points', handleMouseEnter);
      map.off('mouseleave', 'shotspotter-sensors-points', handleMouseLeave);
    };

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle() || !currentData || currentData.features.length === 0) {
        return;
      }

      ensureShotspotterSensorLayers(map, currentData);

      removeHandlers();

      map.on('click', 'shotspotter-sensors-points', handleClick);
      map.on('mouseenter', 'shotspotter-sensors-points', handleMouseEnter);
      map.on('mouseleave', 'shotspotter-sensors-points', handleMouseLeave);

      applyShotspotterSensorsVisibility(map, isVisibleRef.current);
    };

    const handleClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) {
        return;
      }

      const props = feature.properties as ShotspotterSensorFeature['properties'];
      const html = renderSensorPopupCard(props);

      const popup = new (mapboxRef?.current || (window as any).mapboxgl).Popup({
        anchor: getPopupAnchor(map, e.lngLat, html),
        offset: 15,
        className: 'sc-popup',
        maxWidth: '320px',
      })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);

      let dragState: PopupDragState | null = null;
      let pinCleanup: (() => void) | null = null;

      dragState = setupPopupDrag(popup, () => {});
      pinCleanup = setupPopupPin(popup, map);

      const originalRemove = popup.remove.bind(popup);
      popup.remove = function () {
        if (dragState) {
          cleanupPopupDrag(popup, dragState);
        }
        if (pinCleanup) {
          pinCleanup();
        }
        return originalRemove();
      };
    };

    addSourceAndLayers();
    map.on('style.load', addSourceAndLayers);

    return () => {
      map.off('style.load', addSourceAndLayers);
      removeHandlers();
    };
  }, [mapReady, data, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    applyShotspotterSensorsVisibility(map, isVisible);
  }, [isVisible, mapRef, mapReady]);

  return { data, loading, error };
};

export function ensureShotspotterSensorLayers(map: Map, data: ShotspotterSensorsGeoJSON) {
  if (!map.getSource('shotspotter-sensors')) {
    map.addSource('shotspotter-sensors', {
      type: 'geojson',
      data,
    });
  } else {
    const source = map.getSource('shotspotter-sensors') as GeoJSONSource;
    source.setData(data);
  }

  if (!map.getLayer('shotspotter-sensors-points')) {
    map.addLayer({
      id: 'shotspotter-sensors-points',
      type: 'circle',
      source: 'shotspotter-sensors',
      paint: {
        'circle-color': SENSOR_COLOR,
        'circle-opacity': 0.7,
        'circle-radius': 4,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff',
      },
    });
  }
}

function applyShotspotterSensorsVisibility(map: Map, isVisible: boolean) {
  const vis = isVisible ? 'visible' : 'none';
  if (map.getLayer('shotspotter-sensors-points')) {
    map.setLayoutProperty('shotspotter-sensors-points', 'visibility', vis);
  }
}
