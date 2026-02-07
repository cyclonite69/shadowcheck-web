import { useEffect, useState, useCallback, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';

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

export const useAgencyOffices = (
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  mapReady: boolean
) => {
  const [data, setData] = useState<AgencyOfficesGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layersAddedRef = useRef(false);

  // Fetch agency offices data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/agency-offices');
        if (!response.ok) throw new Error('Failed to fetch agency offices');
        const geojson = await response.json();
        setData(geojson);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add layers to map
  const addAgencyLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !data || layersAddedRef.current) return;

    // Add source
    if (!map.getSource('agency-offices')) {
      map.addSource('agency-offices', {
        type: 'geojson',
        data,
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

    // Cluster count
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

    // Unclustered points
    if (!map.getLayer('agency-unclustered')) {
      map.addLayer({
        id: 'agency-unclustered',
        type: 'circle',
        source: 'agency-offices',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'office_type'],
            'field_office',
            '#dc2626',
            'resident_agency',
            '#f97316',
            '#fbbf24',
          ],
          'circle-opacity': 0.8,
          'circle-radius': 6,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
        },
      });
    }

    // Add click handler for unclustered points
    map.on('click', 'agency-unclustered', (e) => {
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
            ${props.office_type.replace('_', ' ')}
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
    });

    // Cluster click to zoom
    map.on('click', 'agency-clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['agency-clusters'],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      if (!clusterId) return;

      const source = map.getSource('agency-offices') as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !features[0]?.geometry || features[0].geometry.type !== 'Point') return;
        map.easeTo({
          center: features[0].geometry.coordinates as [number, number],
          zoom: zoom || 10,
        });
      });
    });

    // Cursor pointer
    map.on('mouseenter', 'agency-unclustered', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'agency-unclustered', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'agency-clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'agency-clusters', () => {
      map.getCanvas().style.cursor = '';
    });

    layersAddedRef.current = true;
  }, [mapRef, data]);

  // Add layers when map is ready and data is loaded
  useEffect(() => {
    if (mapReady && data) {
      addAgencyLayers();
    }
  }, [mapReady, data, addAgencyLayers]);

  return { data, loading, error };
};
