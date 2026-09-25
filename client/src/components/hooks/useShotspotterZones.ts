import { useEffect, useRef, useState } from 'react';
import type { Map, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

interface ShotspotterZoneProperties {
  id: number;
  city: string | null;
  state: string | null;
  contract_status: string | null;
}

interface ShotspotterZoneFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: ShotspotterZoneProperties;
}

interface ShotspotterZonesGeoJSON {
  type: 'FeatureCollection';
  features: ShotspotterZoneFeature[];
}

const SHOTSPOTTER_COLOR = '#CC0000';

function renderShotspotterPopupCard(props: ShotspotterZoneProperties): string {
  const location = [props.city, props.state].filter(Boolean).join(', ') || 'Unknown location';
  const status = props.contract_status || 'Unknown';
  return `
    <div style="background:#1e293b;border:1px solid ${SHOTSPOTTER_COLOR}44;border-radius:10px;padding:14px 16px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${SHOTSPOTTER_COLOR};"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${SHOTSPOTTER_COLOR};">ShotSpotter Zone</div>
      </div>
      <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:6px;">${location}</div>
      <div style="font-size:12px;color:#94a3b8;">Contract: ${status}</div>
    </div>
  `;
}

async function fetchShotspotterZones(): Promise<ShotspotterZonesGeoJSON> {
  const response = await fetch('/api/v1/surveillance/shotspotter-zones', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch ShotSpotter zones');
  }
  return response.json();
}

export const useShotspotterZones = (
  mapRef: React.MutableRefObject<Map | null>,
  mapReady: boolean,
  isVisible: boolean = false,
  mapboxRef?: React.MutableRefObject<typeof mapboxglType | null>,
  _clusteringEnabled: boolean = true
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
  } = useAsyncData<ShotspotterZonesGeoJSON>(
    () =>
      hasBeenVisible
        ? fetchShotspotterZones()
        : Promise.resolve({ type: 'FeatureCollection', features: [] } as ShotspotterZonesGeoJSON),
    [hasBeenVisible]
  );
  const error = fetchError?.message ?? null;

  const dataRef = useRef<ShotspotterZonesGeoJSON | null>(null);
  const isVisibleRef = useRef(isVisible);

  dataRef.current = data;
  isVisibleRef.current = isVisible;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data || data.features.length === 0) {
      return;
    }

    const handleClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) {
        return;
      }

      const props = feature.properties as ShotspotterZoneProperties;
      const html = renderShotspotterPopupCard(props);

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

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle() || !currentData || currentData.features.length === 0) {
        return;
      }

      ensureShotspotterLayers(map, currentData);

      map.on('click', 'shotspotter-fill', handleClick);
      map.on('mouseenter', 'shotspotter-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'shotspotter-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      applyShotspotterVisibility(map, isVisibleRef.current);
    };

    addSourceAndLayers();
    map.on('style.load', addSourceAndLayers);

    return () => {
      map.off('style.load', addSourceAndLayers);
    };
  }, [mapReady, data, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    applyShotspotterVisibility(map, isVisible);
  }, [isVisible, mapRef, mapReady]);

  return { data, loading, error };
};

export function ensureShotspotterLayers(map: Map, data: ShotspotterZonesGeoJSON) {
  if (!map.getSource('shotspotter-zones')) {
    map.addSource('shotspotter-zones', { type: 'geojson', data: data as any });
  } else {
    const source = map.getSource('shotspotter-zones') as any;
    if (source.setData) {
      source.setData(data as any);
    }
  }

  if (!map.getLayer('shotspotter-fill')) {
    map.addLayer({
      id: 'shotspotter-fill',
      type: 'fill',
      source: 'shotspotter-zones',
      paint: {
        'fill-color': SHOTSPOTTER_COLOR,
        'fill-opacity': 0.15,
      },
    });
  }

  if (!map.getLayer('shotspotter-outline')) {
    map.addLayer({
      id: 'shotspotter-outline',
      type: 'line',
      source: 'shotspotter-zones',
      paint: {
        'line-color': SHOTSPOTTER_COLOR,
        'line-width': 1.5,
      },
    });
  }
}

function applyShotspotterVisibility(map: Map, isVisible: boolean) {
  const vis = isVisible ? 'visible' : 'none';
  ['shotspotter-fill', 'shotspotter-outline'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  });
}
