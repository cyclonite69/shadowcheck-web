import { useEffect, useRef } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import { agencyApi } from '../../api/agencyApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { renderCourthousePopupCard } from '../../utils/geospatial/renderMapPopupCards';

interface CourthouseFeature {
  type: 'Feature';
  id: number;
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
    city: string;
    state: string;
    active: boolean;
  };
}

interface FederalCourthousesGeoJSON {
  type: 'FeatureCollection';
  features: CourthouseFeature[];
}

export const useFederalCourthouses = (
  mapRef: React.MutableRefObject<Map | null>,
  mapReady: boolean,
  isVisible: boolean = true
) => {
  const {
    data,
    loading,
    error: fetchError,
  } = useAsyncData<FederalCourthousesGeoJSON>(() => agencyApi.getFederalCourthouses(), []);
  const error = fetchError?.message ?? null;

  const dataRef = useRef<FederalCourthousesGeoJSON | null>(null);
  const isVisibleRef = useRef(isVisible);

  // Keep refs in sync
  dataRef.current = data;
  isVisibleRef.current = isVisible;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data) return;

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle() || !currentData) return;

      // Source
      if (!map.getSource('federal-courthouses')) {
        map.addSource('federal-courthouses', {
          type: 'geojson',
          data: currentData,
          cluster: true,
          clusterMaxZoom: 10,
          clusterRadius: 50,
        });
      }

      // Cluster circles (Gold/Yellow)
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

      // Cluster count labels
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

      // District courts (gold)
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

      // Circuit courts of appeals (purple)
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

      // Specialty/other (teal)
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

      const UNCLUSTERED_LAYERS = [
        'courthouse-district',
        'courthouse-circuit',
        'courthouse-specialty',
      ];
      UNCLUSTERED_LAYERS.forEach((id) => {
        map.on('click', id, handleClick);
        map.on('mouseenter', id, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', id, () => {
          map.getCanvas().style.cursor = '';
        });
      });
      map.on('click', 'courthouse-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['courthouse-clusters'],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;

        const source = map.getSource('federal-courthouses') as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !features[0]?.geometry || features[0].geometry.type !== 'Point') return;
          map.easeTo({
            center: features[0].geometry.coordinates as [number, number],
            zoom: zoom || 10,
          });
        });
      });

      // Cursor pointer
      map.on('mouseenter', 'courthouse-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'courthouse-clusters', () => {
        map.getCanvas().style.cursor = '';
      });

      // Apply initial visibility
      applyVisibility(map, isVisibleRef.current);
    };

    const handleClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) return;

      const props = feature.properties as CourthouseFeature['properties'];
      const address = `${props.city}, ${props.state}`;

      const html = renderCourthousePopupCard({
        name: props.name,
        courthouseType: props.courthouse_type,
        district: props.district,
        circuit: props.circuit,
        address,
      });

      new (window as any).mapboxgl.Popup({ offset: 15, className: 'sc-popup', maxWidth: '360px' })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
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
    applyVisibility(map, isVisible);
  }, [isVisible, mapRef, mapReady]);

  return { data, loading, error };
};

function applyVisibility(map: Map, isVisible: boolean) {
  const vis = isVisible ? 'visible' : 'none';
  ['courthouse-district', 'courthouse-circuit', 'courthouse-specialty'].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  });
  if (map.getLayer('courthouse-clusters')) {
    map.setLayoutProperty('courthouse-clusters', 'visibility', vis);
  }
  if (map.getLayer('courthouse-cluster-count')) {
    map.setLayoutProperty('courthouse-cluster-count', 'visibility', vis);
  }
}
