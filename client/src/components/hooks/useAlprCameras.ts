import { useEffect, useRef, useState } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { agencyApi, type AlprCameraFeature, type AlprCamerasGeoJSON } from '../../api/agencyApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

const ALPR_COLOR = '#d946ef';
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

function renderAlprPopupCard(
  props: AlprCameraFeature['properties'],
  coordinates: AlprCameraFeature['geometry']['coordinates']
): string {
  const fallbackLocation = `${coordinates[1]}, ${coordinates[0]}`;
  const detailRows: PopupDetail[] = [
    ['Manufacturer', props.manufacturer],
    ['Camera Type', props.camera_type],
    ['Operator', props.operator],
    ['Direction', props.direction],
    ['Mount', props.camera_mount],
    ['Surv. Zone', props.surveillance_zone],
    ['Power', props.electricity],
    ['Identifier', props.osm_id || props.id],
  ];
  const details = detailRows
    .filter((detail): detail is PopulatedPopupDetail => Boolean(detail[1]))
    .map(
      ([label, value]) =>
        `<div style="font-size:12px;color:#cbd5e1;margin-top:4px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</div>`
    )
    .join('');
  return `
    <div style="background:#1e293b;border:1px solid ${ALPR_COLOR}44;border-radius:10px;padding:14px 16px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${ALPR_COLOR};"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${ALPR_COLOR};">ALPR Camera (OSM)</div>
      </div>
      <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:6px;">${escapeHtml(fallbackLocation)}</div>
      ${details}
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Source: OpenStreetMap</div>
    </div>
  `;
}

export const useAlprCameras = (
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
  } = useAsyncData<AlprCamerasGeoJSON>(
    () =>
      hasBeenVisible
        ? agencyApi.getAlprCameras()
        : Promise.resolve({ type: 'FeatureCollection', features: [] } as AlprCamerasGeoJSON),
    [hasBeenVisible]
  );
  const error = fetchError?.message ?? null;

  const dataRef = useRef<AlprCamerasGeoJSON | null>(null);
  const isVisibleRef = useRef(isVisible);
  const clusteringEnabledRef = useRef(clusteringEnabled);

  dataRef.current = data;
  isVisibleRef.current = isVisible;
  clusteringEnabledRef.current = clusteringEnabled;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data || data.features.length === 0) {
      return;
    }

    const handleClusterClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['alpr-clusters'],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      if (!clusterId) {
        return;
      }

      const source = map.getSource('alpr-cameras') as GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !features[0]?.geometry || features[0].geometry.type !== 'Point') {
          return;
        }
        map.easeTo({
          center: features[0].geometry.coordinates as [number, number],
          zoom: zoom || 10,
        });
      });
    };

    const handleMouseEnterUnclustered = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeaveUnclustered = () => {
      map.getCanvas().style.cursor = '';
    };
    const handleMouseEnterClusters = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeaveClusters = () => {
      map.getCanvas().style.cursor = '';
    };

    const removeHandlers = () => {
      map.off('click', 'alpr-unclustered', handleClick);
      map.off('click', 'alpr-clusters', handleClusterClick);
      map.off('mouseenter', 'alpr-unclustered', handleMouseEnterUnclustered);
      map.off('mouseleave', 'alpr-unclustered', handleMouseLeaveUnclustered);
      map.off('mouseenter', 'alpr-clusters', handleMouseEnterClusters);
      map.off('mouseleave', 'alpr-clusters', handleMouseLeaveClusters);
    };

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle() || !currentData || currentData.features.length === 0) {
        return;
      }

      ensureAlprLayers(map, currentData, clusteringEnabledRef.current);

      removeHandlers();

      map.on('click', 'alpr-unclustered', handleClick);
      map.on('click', 'alpr-clusters', handleClusterClick);

      map.on('mouseenter', 'alpr-unclustered', handleMouseEnterUnclustered);
      map.on('mouseleave', 'alpr-unclustered', handleMouseLeaveUnclustered);
      map.on('mouseenter', 'alpr-clusters', handleMouseEnterClusters);
      map.on('mouseleave', 'alpr-clusters', handleMouseLeaveClusters);

      applyAlprVisibility(map, isVisibleRef.current);
    };

    const handleClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) {
        return;
      }

      const props = feature.properties as AlprCameraFeature['properties'];
      const coordinates: AlprCameraFeature['geometry']['coordinates'] =
        feature.geometry.type === 'Point' && feature.geometry.coordinates.length >= 2
          ? [Number(feature.geometry.coordinates[0]), Number(feature.geometry.coordinates[1])]
          : [e.lngLat.lng, e.lngLat.lat];
      const html = renderAlprPopupCard(props, coordinates);

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
    applyAlprVisibility(map, isVisible);
  }, [isVisible, mapRef, mapReady]);

  return { data, loading, error };
};

export function ensureAlprLayers(map: Map, data: AlprCamerasGeoJSON, clusteringEnabled: boolean) {
  if (!map.getSource('alpr-cameras')) {
    map.addSource('alpr-cameras', {
      type: 'geojson',
      data,
      cluster: clusteringEnabled,
      clusterMaxZoom: 10,
      clusterRadius: 50,
    });
  } else {
    const source = map.getSource('alpr-cameras') as GeoJSONSource;
    source.setData(data);
  }

  if (!map.getLayer('alpr-clusters')) {
    map.addLayer({
      id: 'alpr-clusters',
      type: 'circle',
      source: 'alpr-cameras',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ALPR_COLOR,
        'circle-opacity': 0.7,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
  }

  if (!map.getLayer('alpr-cluster-count')) {
    map.addLayer({
      id: 'alpr-cluster-count',
      type: 'symbol',
      source: 'alpr-cameras',
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

  if (!map.getLayer('alpr-unclustered')) {
    map.addLayer({
      id: 'alpr-unclustered',
      type: 'circle',
      source: 'alpr-cameras',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ALPR_COLOR,
        'circle-opacity': 0.8,
        'circle-radius': 5,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
  }
}

function applyAlprVisibility(map: Map, isVisible: boolean) {
  const vis = isVisible ? 'visible' : 'none';
  ['alpr-unclustered', 'alpr-clusters', 'alpr-cluster-count'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  });
}
