import { useEffect, useState, useRef } from 'react';
import type { Map, GeoJSONSource, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl';
import { agencyApi } from '../../api/agencyApi';

interface AgencyOffice {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: number;
    name: string;
    office_type: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    phone: string;
    website: string | null;
    parent_office: string | null;
  };
}

interface AgencyOfficesGeoJSON {
  type: 'FeatureCollection';
  features: AgencyOffice[];
}

export interface AgencyVisibility {
  fieldOffices: boolean;
  residentAgencies: boolean;
}

export const useAgencyOffices = (
  mapRef: React.MutableRefObject<Map | null>,
  mapReady: boolean,
  visibility: AgencyVisibility = { fieldOffices: true, residentAgencies: true }
) => {
  const [data, setData] = useState<AgencyOfficesGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<AgencyOfficesGeoJSON | null>(null);
  const visibilityRef = useRef(visibility);

  // Keep refs in sync so the style.load handler always uses current values
  dataRef.current = data;
  visibilityRef.current = visibility;

  // Fetch agency offices data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const geojson = await agencyApi.getAgencyOffices();
        setData(geojson);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add/restore layers on map — runs on initial load and after every style reload
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data) return;

    const addSourceAndLayers = () => {
      const currentData = dataRef.current;
      if (!map.getStyle() || !currentData) return;

      // Source
      if (!map.getSource('agency-offices')) {
        map.addSource('agency-offices', {
          type: 'geojson',
          data: currentData,
          cluster: true,
          clusterMaxZoom: 10,
          clusterRadius: 50,
        });
      }

      // Cluster circles
      if (!map.getLayer('agency-clusters')) {
        map.addLayer({
          id: 'agency-clusters',
          type: 'circle',
          source: 'agency-offices',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#dc2626',
            'circle-opacity': 0.7,
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
      }

      // Cluster count labels
      if (!map.getLayer('agency-cluster-count')) {
        map.addLayer({
          id: 'agency-cluster-count',
          type: 'symbol',
          source: 'agency-offices',
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

      // Field office unclustered points (red)
      if (!map.getLayer('agency-field-unclustered')) {
        map.addLayer({
          id: 'agency-field-unclustered',
          type: 'circle',
          source: 'agency-offices',
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'office_type'], 'field_office'],
          ],
          paint: {
            'circle-color': '#dc2626',
            'circle-opacity': 0.8,
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
          },
        });
      }

      // Resident agency unclustered points (orange)
      if (!map.getLayer('agency-resident-unclustered')) {
        map.addLayer({
          id: 'agency-resident-unclustered',
          type: 'circle',
          source: 'agency-offices',
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'office_type'], 'resident_agency'],
          ],
          paint: {
            'circle-color': '#f97316',
            'circle-opacity': 0.8,
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
          },
        });
      }

      // Click handler — field office unclustered points
      map.on('click', 'agency-field-unclustered', handleUnclusteredClick);
      map.on('click', 'agency-resident-unclustered', handleUnclusteredClick);

      // Cluster click to zoom
      map.on('click', 'agency-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['agency-clusters'],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;

        const source = map.getSource('agency-offices') as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !features[0]?.geometry || features[0].geometry.type !== 'Point') return;
          map.easeTo({
            center: features[0].geometry.coordinates as [number, number],
            zoom: zoom || 10,
          });
        });
      });

      // Cursor pointer
      map.on('mouseenter', 'agency-field-unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'agency-field-unclustered', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'agency-resident-unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'agency-resident-unclustered', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'agency-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'agency-clusters', () => {
        map.getCanvas().style.cursor = '';
      });

      // Apply current visibility
      applyVisibility(map, visibilityRef.current);
    };

    const handleUnclusteredClick = (e: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) return;

      const props = feature.properties as AgencyOffice['properties'];
      const address = [
        props.address_line1,
        props.address_line2,
        props.city,
        props.state,
        props.postal_code,
      ]
        .filter(Boolean)
        .join(', ');

      const html = `
        <div style="font-family: system-ui; font-size: 13px; max-width: 280px;">
          <div style="font-weight: 600; color: #dc2626; margin-bottom: 6px;">
            ${props.name}
          </div>
          <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">
            ${String(props.office_type).replace('_', ' ')}
          </div>
          <div style="color: #334155; font-size: 12px; line-height: 1.5;">
            ${address}
          </div>
          ${props.phone ? `<div style="color: #334155; font-size: 12px; margin-top: 4px;">📞 ${props.phone}</div>` : ''}
          ${props.website ? `<div style="margin-top: 6px;"><a href="${props.website}" target="_blank" style="color: #2563eb; text-decoration: none; font-size: 11px;">Visit Website →</a></div>` : ''}
          ${props.parent_office ? `<div style="color: #64748b; font-size: 11px; margin-top: 6px;">Parent: ${props.parent_office}</div>` : ''}
        </div>
      `;

      new (window as any).mapboxgl.Popup({ offset: 15 })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    };

    // Add layers now
    addSourceAndLayers();

    // Re-add after style changes (map.setStyle() strips all custom sources/layers)
    map.on('style.load', addSourceAndLayers);

    return () => {
      map.off('style.load', addSourceAndLayers);
    };
  }, [mapReady, data, mapRef]);

  // Toggle visibility when the prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    applyVisibility(map, visibility);
  }, [visibility, mapRef, mapReady]);

  return { data, loading, error };
};

function applyVisibility(map: Map, visibility: AgencyVisibility) {
  const anyVisible = visibility.fieldOffices || visibility.residentAgencies;

  // Clusters show when at least one type is visible
  const clusterVis = anyVisible ? 'visible' : 'none';
  if (map.getLayer('agency-clusters')) {
    map.setLayoutProperty('agency-clusters', 'visibility', clusterVis);
  }
  if (map.getLayer('agency-cluster-count')) {
    map.setLayoutProperty('agency-cluster-count', 'visibility', clusterVis);
  }

  // Per-type unclustered layers
  if (map.getLayer('agency-field-unclustered')) {
    map.setLayoutProperty(
      'agency-field-unclustered',
      'visibility',
      visibility.fieldOffices ? 'visible' : 'none'
    );
  }
  if (map.getLayer('agency-resident-unclustered')) {
    map.setLayoutProperty(
      'agency-resident-unclustered',
      'visibility',
      visibility.residentAgencies ? 'visible' : 'none'
    );
  }
}
