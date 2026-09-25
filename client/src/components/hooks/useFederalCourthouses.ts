import { useEffect, useRef, useState } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { agencyApi } from '../../api/agencyApi';
import type { CourthouseMatch } from '../../api/agencyApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { renderCourthousePopupCard } from '../../utils/geospatial/renderMapPopupCards';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

interface CourthouseFeature {
  type: 'Feature';
  id: number | string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: number;
    name: string;
    short_name: string | null;
    courthouse_type: string;
    district: string;
    circuit: string;
    address_line1: string | null;
    city: string;
    state: string;
    postal_code: string | null;
    active: boolean;
  };
}

interface FederalCourthousesGeoJSON {
  type: 'FeatureCollection';
  features: CourthouseFeature[];
}

function buildNearestCourthouseGeoJSON(courthouses: CourthouseMatch[]): FederalCourthousesGeoJSON {
  return {
    type: 'FeatureCollection',
    features: courthouses
      .filter(
        (courthouse) =>
          courthouse.id !== null &&
          courthouse.id !== undefined &&
          courthouse.name &&
          courthouse.latitude !== null &&
          courthouse.latitude !== undefined &&
          courthouse.longitude !== null &&
          courthouse.longitude !== undefined
      )
      .map((courthouse) => ({
        type: 'Feature',
        id: `${courthouse.cluster_id ?? 'single'}:${courthouse.id}`,
        geometry: {
          type: 'Point',
          coordinates: [courthouse.longitude!, courthouse.latitude!],
        },
        properties: {
          id: courthouse.id!,
          name: courthouse.name!,
          short_name: courthouse.short_name ?? null,
          courthouse_type: courthouse.courthouse_type ?? 'district_court',
          district: courthouse.district ?? '',
          circuit: courthouse.circuit ?? '',
          address_line1: null,
          city: courthouse.city ?? '',
          state: courthouse.state ?? '',
          postal_code: courthouse.postal_code ?? null,
          active: true,
        },
      })),
  };
}

export const useFederalCourthouses = (
  mapRef: React.MutableRefObject<Map | null>,
  mapReady: boolean,
  isVisible: boolean = true,
  mapboxRef?: React.MutableRefObject<typeof mapboxglType | null>,
  clusteringEnabled: boolean = true,
  courthouseMatches?: CourthouseMatch[]
) => {
  const [hasBeenVisible, setHasBeenVisible] = useState(isVisible);

  useEffect(() => {
    if (isVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [isVisible, hasBeenVisible]);

  const shouldFetchAllCourthouses = hasBeenVisible && courthouseMatches === undefined;
  const {
    data,
    loading,
    error: fetchError,
  } = useAsyncData<FederalCourthousesGeoJSON>(
    () =>
      shouldFetchAllCourthouses
        ? agencyApi.getFederalCourthouses()
        : Promise.resolve({ type: 'FeatureCollection', features: [] } as FederalCourthousesGeoJSON),
    [shouldFetchAllCourthouses]
  );
  const error = fetchError?.message ?? null;
  const renderedData = courthouseMatches ? buildNearestCourthouseGeoJSON(courthouseMatches) : data;
  const renderedDataKey = courthouseMatches
    ? courthouseMatches
        .map((courthouse) => `${courthouse.cluster_id ?? 'single'}:${courthouse.id}`)
        .sort()
        .join('|')
    : `all:${data?.features.length ?? 0}`;

  const dataRef = useRef<FederalCourthousesGeoJSON | null>(null);
  const isVisibleRef = useRef(isVisible);
  const clusteringEnabledRef = useRef(clusteringEnabled);

  // Keep refs in sync
  dataRef.current = renderedData ?? null;
  isVisibleRef.current = isVisible;
  clusteringEnabledRef.current = clusteringEnabled;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const unclusteredLayers = ['courthouse-district', 'courthouse-circuit', 'courthouse-specialty'];
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    const handleClusterClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['courthouse-clusters'],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      if (!clusterId) {
        return;
      }

      const source = map.getSource('federal-courthouses') as GeoJSONSource;
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

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle()) {
        return;
      }
      if (!currentData || currentData.features.length === 0) {
        resetFederalCourthouseLayers(map, currentData, isVisibleRef.current, false);
        return;
      }

      ensureFederalCourthouseLayers(map, currentData, clusteringEnabledRef.current);

      unclusteredLayers.forEach((id) => {
        map.off('click', id, handleClick);
        map.off('mouseenter', id, handleMouseEnter);
        map.off('mouseleave', id, handleMouseLeave);
        map.on('click', id, handleClick);
        map.on('mouseenter', id, handleMouseEnter);
        map.on('mouseleave', id, handleMouseLeave);
      });
      map.off('click', 'courthouse-clusters', handleClusterClick);
      map.off('mouseenter', 'courthouse-clusters', handleMouseEnter);
      map.off('mouseleave', 'courthouse-clusters', handleMouseLeave);
      map.on('click', 'courthouse-clusters', handleClusterClick);

      map.on('mouseenter', 'courthouse-clusters', handleMouseEnter);
      map.on('mouseleave', 'courthouse-clusters', handleMouseLeave);

      // Apply initial visibility
      applyVisibility(map, isVisibleRef.current);
    };

    const handleClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) {
        return;
      }

      const props = feature.properties as CourthouseFeature['properties'];
      const addressParts = [
        props.address_line1,
        [props.city, props.state, props.postal_code].filter(Boolean).join(', '),
      ].filter(Boolean);
      const address = addressParts.join('\n');

      const html = renderCourthousePopupCard({
        name: props.name,
        courthouseType: props.courthouse_type,
        district: props.district,
        circuit: props.circuit,
        address,
      });

      const popup = new (mapboxRef?.current || (window as any).mapboxgl).Popup({
        anchor: getPopupAnchor(map, e.lngLat, html),
        offset: 15,
        className: 'sc-popup',
        maxWidth: '360px',
      })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);

      // Setup drag and tether
      let dragState: PopupDragState | null = null;
      let pinCleanup: (() => void) | null = null;

      dragState = setupPopupDrag(popup, (_offset) => {
        // Drag handler (tether line removed)
      });

      // Tether line removed for cleaner UI

      // Setup pin to viewport functionality
      pinCleanup = setupPopupPin(popup, map);

      // Cleanup on popup close
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
      unclusteredLayers.forEach((id) => {
        if (!map.getLayer(id)) {
          return;
        }
        map.off('click', id, handleClick);
        map.off('mouseenter', id, handleMouseEnter);
        map.off('mouseleave', id, handleMouseLeave);
      });
      if (map.getLayer('courthouse-clusters')) {
        map.off('click', 'courthouse-clusters', handleClusterClick);
        map.off('mouseenter', 'courthouse-clusters', handleMouseEnter);
        map.off('mouseleave', 'courthouse-clusters', handleMouseLeave);
      }
    };
  }, [mapReady, renderedDataKey, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    applyVisibility(map, isVisible);
  }, [isVisible, mapRef, mapReady]);

  return { data: renderedData, loading, error };
};

export function ensureFederalCourthouseLayers(
  map: Map,
  data: FederalCourthousesGeoJSON,
  clusteringEnabled: boolean
) {
  if (!map.getSource('federal-courthouses')) {
    map.addSource('federal-courthouses', {
      type: 'geojson',
      data,
      cluster: clusteringEnabled,
      clusterMaxZoom: 10,
      clusterRadius: 50,
    });
  } else {
    const source = map.getSource('federal-courthouses') as GeoJSONSource;
    source.setData(data);
  }

  if (!map.getLayer('courthouse-clusters')) {
    map.addLayer({
      id: 'courthouse-clusters',
      type: 'circle',
      source: 'federal-courthouses',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#f59e0b',
        'circle-opacity': 0.7,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
  }

  if (!map.getLayer('courthouse-cluster-count')) {
    map.addLayer({
      id: 'courthouse-cluster-count',
      type: 'symbol',
      source: 'federal-courthouses',
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

  if (!map.getLayer('courthouse-district')) {
    map.addLayer({
      id: 'courthouse-district',
      type: 'circle',
      source: 'federal-courthouses',
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'courthouse_type'], 'district_court'],
      ],
      paint: {
        'circle-color': '#f59e0b',
        'circle-opacity': 0.85,
        'circle-radius': 6,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
  }

  if (!map.getLayer('courthouse-circuit')) {
    map.addLayer({
      id: 'courthouse-circuit',
      type: 'circle',
      source: 'federal-courthouses',
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'courthouse_type'], 'circuit_court_of_appeals'],
      ],
      paint: {
        'circle-color': '#a855f7',
        'circle-opacity': 0.85,
        'circle-radius': 7,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
  }

  if (!map.getLayer('courthouse-specialty')) {
    map.addLayer({
      id: 'courthouse-specialty',
      type: 'circle',
      source: 'federal-courthouses',
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        [
          '!',
          [
            'in',
            ['get', 'courthouse_type'],
            ['literal', ['district_court', 'circuit_court_of_appeals']],
          ],
        ],
      ],
      paint: {
        'circle-color': '#06b6d4',
        'circle-opacity': 0.85,
        'circle-radius': 5,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
  }
}

export function resetFederalCourthouseLayers(
  map: Map,
  data: FederalCourthousesGeoJSON | null | undefined,
  isVisible: boolean,
  clusteringEnabled: boolean
) {
  [
    'courthouse-clusters',
    'courthouse-cluster-count',
    'courthouse-district',
    'courthouse-circuit',
    'courthouse-specialty',
  ].forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource('federal-courthouses')) {
    map.removeSource('federal-courthouses');
  }
  if (!data || data.features.length === 0) {
    return;
  }
  ensureFederalCourthouseLayers(map, data, clusteringEnabled);
  applyVisibility(map, isVisible);
}

function applyVisibility(map: Map, isVisible: boolean) {
  const vis = isVisible ? 'visible' : 'none';
  ['courthouse-district', 'courthouse-circuit', 'courthouse-specialty'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  });
  if (map.getLayer('courthouse-clusters')) {
    map.setLayoutProperty('courthouse-clusters', 'visibility', vis);
  }
  if (map.getLayer('courthouse-cluster-count')) {
    map.setLayoutProperty('courthouse-cluster-count', 'visibility', vis);
  }
}
