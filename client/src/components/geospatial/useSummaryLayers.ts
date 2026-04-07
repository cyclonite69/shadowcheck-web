import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';

type ObservationSet = {
  bssid: string;
  observations: Observation[];
};

type SummaryLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapStyle?: string;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
  showNetworkSummaries?: boolean;
};

export const useSummaryLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  mapStyle,
  activeObservationSets,
  networkLookup,
  showNetworkSummaries = false,
}: SummaryLayerProps) => {
  const networkLookupRef = useRef(networkLookup);

  useEffect(() => {
    networkLookupRef.current = networkLookup;
  }, [networkLookup]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    const ensureSummaryLayers = () => {
      if (!map.isStyleLoaded()) return false;

      if (!map.getSource('network-summaries')) {
        map.addSource('network-summaries', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });
      }

      if (!map.getLayer('network-centroid-markers')) {
        map.addLayer({
          id: 'network-centroid-markers',
          type: 'circle',
          source: 'network-summaries',
          filter: ['==', ['get', 'markerType'], 'centroid'],
          paint: {
            'circle-radius': 12,
            'circle-color': 'rgba(96, 165, 250, 0.1)',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#60a5fa',
            'circle-opacity': 1,
          },
        });
      }

      if (!map.getLayer('network-weighted-markers')) {
        map.addLayer({
          id: 'network-weighted-markers',
          type: 'circle',
          source: 'network-summaries',
          filter: ['==', ['get', 'markerType'], 'weighted'],
          paint: {
            'circle-radius': 12,
            'circle-color': 'rgba(52, 211, 153, 0.1)',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#34d399',
            'circle-opacity': 1,
          },
        });
      }

      if (!map.getLayer('network-marker-labels')) {
        map.addLayer({
          id: 'network-marker-labels',
          type: 'symbol',
          source: 'network-summaries',
          layout: {
            'text-field': ['case', ['==', ['get', 'markerType'], 'centroid'], '◊', '▲'],
            'text-size': 16,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-offset': [0, 0],
          },
          paint: {
            'text-color': ['case', ['==', ['get', 'markerType'], 'centroid'], '#60a5fa', '#34d399'],
            'text-opacity': 0.9,
          },
        });
      }

      return true;
    };

    const syncSummarySource = () => {
      if (!ensureSummaryLayers()) return false;
      const source = map.getSource('network-summaries') as GeoJSONSource | undefined;
      if (!source) return false;

      if (showNetworkSummaries && activeObservationSets.length > 0) {
        const summaryFeatures: any[] = [];

        activeObservationSets.forEach((set) => {
          const network = networkLookupRef.current.get(set.bssid);
          if (!network) return;

          // Add centroid marker if coordinates exist
          if (
            network.centroid_lat !== null &&
            network.centroid_lat !== undefined &&
            network.centroid_lon !== null &&
            network.centroid_lon !== undefined
          ) {
            summaryFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [network.centroid_lon, network.centroid_lat],
              },
              properties: {
                bssid: set.bssid,
                markerType: 'centroid',
                ssid: network.ssid,
              },
            });
          }

          // Add weighted marker if coordinates exist
          if (
            network.weighted_lat !== null &&
            network.weighted_lat !== undefined &&
            network.weighted_lon !== null &&
            network.weighted_lon !== undefined
          ) {
            summaryFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [network.weighted_lon, network.weighted_lat],
              },
              properties: {
                bssid: set.bssid,
                markerType: 'weighted',
                ssid: network.ssid,
              },
            });
          }
        });

        source.setData({
          type: 'FeatureCollection',
          features: summaryFeatures,
        });
      } else {
        // Clear markers when disabled
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      return true;
    };

    try {
      if (syncSummarySource()) return;
      const handleStyleLoad = () => {
        syncSummarySource();
      };
      map.once('style.load', handleStyleLoad);
      return () => {
        map.off('style.load', handleStyleLoad);
      };
    } catch (err) {
      console.error('[useSummaryLayers] Error managing network summary markers:', err);
    }
  }, [mapReady, mapRef, mapboxRef, activeObservationSets, showNetworkSummaries, mapStyle]);
};
