import { useEffect, useRef, useState } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import {
  agencyApi,
  type DeflockCameraFeature,
  type DeflockCamerasGeoJSON,
} from '../../api/agencyApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

const DEFLOCK_COLOR = '#FF6B00';
type PopupDetail = readonly [label: string, value: string | null];
type PopulatedPopupDetail = readonly [label: string, value: string];

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character
  );
}

function renderDeflockPopupCard(props: DeflockCameraFeature['properties']): string {
  const location =
    [props.address, props.street && [props.housenumber, props.street].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ') ||
    [props.city, props.state, props.country].filter(Boolean).join(', ') ||
    'Unknown location';
  const detailRows: PopupDetail[] = [
    ['Type', props.camera_type],
    ['Operator', props.operator || props.agency],
    ['Manufacturer', props.manufacturer],
    ['Direction', props.direction],
    ['Mount', props.camera_mount],
    [
      'Surveillance',
      [props.surveillance_type, props.surveillance_zone].filter(Boolean).join(' / '),
    ],
    ['Source ID', props.source_id],
  ];
  const details = detailRows
    .filter((detail): detail is PopulatedPopupDetail => Boolean(detail[1]))
    .map(
      ([label, value]) =>
        `<div style="font-size:12px;color:#cbd5e1;margin-top:4px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</div>`
    )
    .join('');
  const safeLocation = escapeHtml(location);
  const safeSource = escapeHtml(props.source);
  return `
    <div style="background:#1e293b;border:1px solid ${DEFLOCK_COLOR}44;border-radius:10px;padding:14px 16px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${DEFLOCK_COLOR};"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${DEFLOCK_COLOR};">Flock Camera (DeFlock)</div>
      </div>
      <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:6px;">${safeLocation}</div>
      ${details}
      <div style="font-size:12px;color:#94a3b8;">Source: ${safeSource}</div>
    </div>
  `;
}

export const useDeflockCameras = (
  mapRef: React.MutableRefObject<Map | null>,
  mapReady: boolean,
  isVisible: boolean = false,
  mapboxRef?: React.MutableRefObject<typeof mapboxglType | null>,
  clusteringEnabled: boolean = true
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
  } = useAsyncData<DeflockCamerasGeoJSON>(
    () =>
      hasBeenVisible
        ? agencyApi.getDeflockCameras()
        : Promise.resolve({ type: 'FeatureCollection', features: [] } as DeflockCamerasGeoJSON),
    [hasBeenVisible]
  );
  const error = fetchError?.message ?? null;

  const dataRef = useRef<DeflockCamerasGeoJSON | null>(null);
  const isVisibleRef = useRef(isVisible);
  const clusteringEnabledRef = useRef(clusteringEnabled);

  dataRef.current = data;
  isVisibleRef.current = isVisible;
  clusteringEnabledRef.current = clusteringEnabled;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data || data.features.length === 0) return;

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle() || !currentData || currentData.features.length === 0) return;

      ensureDeflockLayers(map, currentData, clusteringEnabledRef.current);

      map.on('click', 'deflock-unclustered', handleClick);
      map.on('click', 'deflock-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['deflock-clusters'],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;

        const source = map.getSource('deflock-cameras') as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !features[0]?.geometry || features[0].geometry.type !== 'Point') return;
          map.easeTo({
            center: features[0].geometry.coordinates as [number, number],
            zoom: zoom || 10,
          });
        });
      });

      map.on('mouseenter', 'deflock-unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'deflock-unclustered', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'deflock-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'deflock-clusters', () => {
        map.getCanvas().style.cursor = '';
      });

      applyDeflockVisibility(map, isVisibleRef.current);
    };

    const handleClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) return;

      const props = feature.properties as DeflockCameraFeature['properties'];
      const html = renderDeflockPopupCard(props);

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
        if (dragState) cleanupPopupDrag(popup, dragState);
        if (pinCleanup) pinCleanup();
        return originalRemove();
      };
    };

    addSourceAndLayers();
    map.on('style.load', addSourceAndLayers);

    return () => {
      map.off('style.load', addSourceAndLayers);
    };
  }, [mapReady, data, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyDeflockVisibility(map, isVisible);
  }, [isVisible, mapRef, mapReady]);

  return { data, loading, error };
};

export function ensureDeflockLayers(
  map: Map,
  data: DeflockCamerasGeoJSON,
  clusteringEnabled: boolean
) {
  if (!map.getSource('deflock-cameras')) {
    map.addSource('deflock-cameras', {
      type: 'geojson',
      data,
      cluster: clusteringEnabled,
      clusterMaxZoom: 10,
      clusterRadius: 50,
    });
  } else {
    const source = map.getSource('deflock-cameras') as GeoJSONSource;
    source.setData(data);
  }

  if (!map.getLayer('deflock-clusters')) {
    map.addLayer({
      id: 'deflock-clusters',
      type: 'circle',
      source: 'deflock-cameras',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': DEFLOCK_COLOR,
        'circle-opacity': 0.7,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
  }

  if (!map.getLayer('deflock-cluster-count')) {
    map.addLayer({
      id: 'deflock-cluster-count',
      type: 'symbol',
      source: 'deflock-cameras',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#fff',
      },
    });
  }

  if (!map.getLayer('deflock-unclustered')) {
    map.addLayer({
      id: 'deflock-unclustered',
      type: 'circle',
      source: 'deflock-cameras',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': DEFLOCK_COLOR,
        'circle-opacity': 0.8,
        'circle-radius': 5,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
  }
}

function applyDeflockVisibility(map: Map, isVisible: boolean) {
  const vis = isVisible ? 'visible' : 'none';
  ['deflock-unclustered', 'deflock-clusters', 'deflock-cluster-count'].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  });
}
