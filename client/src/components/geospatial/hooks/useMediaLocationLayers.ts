import React, { useEffect, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { createRoot } from 'react-dom/client';
import { networkApi } from '../../../api/networkApi';
import { MatchedMediaCarouselPopup } from '../media/MatchedMediaCarouselPopup';

type MediaLocationProps = {
  mapReady: boolean;
  mapRef: React.MutableRefObject<MapboxMap | null>;
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>;
  mapStyle?: string;
  showMediaLocations: boolean;
};

export type MediaLocationStatus = 'idle' | 'loading' | 'active' | 'empty' | 'error';

/**
 * Hook to manage media location layers and interaction popups.
 */
export const useMediaLocationLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  mapStyle,
  showMediaLocations,
}: MediaLocationProps) => {
  const [status, setStatus] = useState<MediaLocationStatus>('idle');

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;

    const cleanupLayersAndSources = () => {
      // Unmatched media layers
      if (map.getLayer('media-location-icons')) {
        map.removeLayer('media-location-icons');
      }
      if (map.getLayer('media-location-markers')) {
        map.removeLayer('media-location-markers');
      }
      if (map.getSource('media-locations')) {
        map.removeSource('media-locations');
      }

      // Matched media layers
      if (map.getLayer('matched-media-count-labels')) {
        map.removeLayer('matched-media-count-labels');
      }
      if (map.getLayer('matched-media-fallback-warnings')) {
        map.removeLayer('matched-media-fallback-warnings');
      }
      if (map.getLayer('matched-media-icons')) {
        map.removeLayer('matched-media-icons');
      }
      if (map.getLayer('matched-media-markers')) {
        map.removeLayer('matched-media-markers');
      }
      if (map.getSource('matched-media-locations')) {
        map.removeSource('matched-media-locations');
      }
    };

    if (!showMediaLocations) {
      setStatus('idle');
      cleanupLayersAndSources();
      return;
    }

    let active = true;
    setStatus('loading');

    // Unmatched media popup handler (HTML/DOM template)
    const handleUnmatchedMediaClick = (e: any) => {
      if (!e.features || e.features.length === 0) {
        return;
      }
      const feature = e.features[0];
      const props = feature.properties;
      if (!props) {
        return;
      }

      const html = `
        <div style="padding: 10px; font-family: monospace; font-size: 11px; color: #e2e8f0; background: #0f172a; border-radius: 6px;">
          <div style="font-weight: bold; margin-bottom: 4px; color: #ec4899;">⚠️ UNMATCHED MEDIA</div>
          <div style="margin-bottom: 6px; word-break: break-all;">File: ${props.filename}</div>
          <div style="margin-bottom: 8px; color: #94a3b8;">Captured: ${props.captured_at ? new Date(props.captured_at).toLocaleString() : 'N/A'}</div>
          <div style="display: flex; justify-content: center; background: #1e293b; padding: 4px; border-radius: 4px;">
            <img src="${props.thumbnail_url}" style="max-width: 150px; max-height: 150px; border-radius: 3px; cursor: pointer;" data-media-id="${props.id}" />
          </div>
        </div>
      `;

      if (mapboxgl) {
        const popup = new (mapboxgl as any).Popup({
          offset: 15,
          className: 'sc-popup',
          closeOnClick: true,
          closeButton: false,
        })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);

        const popupEl = popup.getElement();
        if (popupEl) {
          popupEl.addEventListener('click', (ev: MouseEvent) => {
            const target = (ev.target as HTMLElement).closest(
              '[data-media-id]'
            ) as HTMLElement | null;
            if (target) {
              const mediaId = target.getAttribute('data-media-id');
              if (mediaId) {
                window.open(
                  props.inline_url || `/api/v2/networks/media/${mediaId}/inline`,
                  '_blank'
                );
              }
            }
          });
        }
      }
    };

    // Matched media popup handler (React component rendering via React.createElement to support raw TS files)
    const handleMatchedMediaClick = (e: any) => {
      if (!e.features || e.features.length === 0) {
        return;
      }
      const feature = e.features[0];
      const props = feature.properties;
      if (!props) {
        return;
      }

      // Extract props and parse arrays if they were stringified in GeoJSON attributes
      let memberBssids: string[] = [];
      if (props.member_bssids) {
        if (typeof props.member_bssids === 'string') {
          try {
            memberBssids = JSON.parse(props.member_bssids);
          } catch {
            memberBssids = [props.member_bssids];
          }
        } else if (Array.isArray(props.member_bssids)) {
          memberBssids = props.member_bssids;
        }
      }

      let mediaIds: number[] = [];
      if (props.media_ids) {
        if (typeof props.media_ids === 'string') {
          try {
            mediaIds = JSON.parse(props.media_ids).map(Number);
          } catch {
            mediaIds = [Number(props.media_ids)];
          }
        } else if (Array.isArray(props.media_ids)) {
          mediaIds = props.media_ids;
        }
      }

      if (mapboxgl) {
        const popupEl = document.createElement('div');

        const popup = new (mapboxgl as any).Popup({
          offset: 15,
          className: 'sc-popup matched-media-popup',
          closeOnClick: true,
          closeButton: false,
        })
          .setLngLat(e.lngLat)
          .setDOMContent(popupEl)
          .addTo(map);

        const root = createRoot(popupEl);
        root.render(
          React.createElement(MatchedMediaCarouselPopup, {
            memberBssids,
            mediaIds,
            markerLocationSource: props.marker_location_source,
            observationId: props.observation_id,
            captureLat: props.capture_lat,
            captureLon: props.capture_lon,
            observationLat: props.observation_lat,
            observationLon: props.observation_lon,
            networkLat: props.network_lat,
            networkLon: props.network_lon,
            onClose: () => popup.remove(),
          })
        );

        popup.on('close', () => {
          root.unmount();
        });
      }
    };

    const loadMediaLocations = async () => {
      try {
        // Load unmatched and matched media GeoJSON datasets concurrently
        const [unmatchedData, matchedData] = await Promise.all([
          networkApi.getUnmatchedMediaGeoJson(),
          networkApi.getMatchedMediaGeoJson(),
        ]);

        if (!active) {
          return;
        }

        // 1. Setup Unmatched Media Layers
        if (!map.getSource('media-locations')) {
          map.addSource('media-locations', {
            type: 'geojson',
            data: unmatchedData,
          });

          map.addLayer({
            id: 'media-location-markers',
            type: 'circle',
            source: 'media-locations',
            paint: {
              'circle-radius': 8,
              'circle-color': '#EC4899', // Pink
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Circle-based fallback for icons (white lens dot)
          map.addLayer({
            id: 'media-location-icons',
            type: 'circle',
            source: 'media-locations',
            paint: {
              'circle-radius': 3,
              'circle-color': '#ffffff',
            },
          });

          map.on('click', 'media-location-markers', handleUnmatchedMediaClick);
        }

        // 2. Setup Matched Media Layers
        if (!map.getSource('matched-media-locations')) {
          map.addSource('matched-media-locations', {
            type: 'geojson',
            data: matchedData,
          });

          // Teal Matched Markers
          map.addLayer({
            id: 'matched-media-markers',
            type: 'circle',
            source: 'matched-media-locations',
            paint: {
              'circle-radius': 8,
              'circle-color': '#0D9488', // Teal
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Inner White Dot
          map.addLayer({
            id: 'matched-media-icons',
            type: 'circle',
            source: 'matched-media-locations',
            paint: {
              'circle-radius': 3,
              'circle-color': '#ffffff',
            },
          });

          // Offset Amber Warning Circle for Fallback Sources
          map.addLayer({
            id: 'matched-media-fallback-warnings',
            type: 'circle',
            source: 'matched-media-locations',
            filter: ['==', ['get', 'marker_location_source'], 'network'],
            paint: {
              'circle-radius': 4,
              'circle-color': '#F59E0B', // Amber
              'circle-stroke-width': 1,
              'circle-stroke-color': '#0f172a',
              'circle-translate': [-8, -8],
            },
          });

          // Marker Count Badges
          map.addLayer({
            id: 'matched-media-count-labels',
            type: 'symbol',
            source: 'matched-media-locations',
            filter: ['>', ['get', 'media_count'], 1],
            layout: {
              'text-field': ['concat', '+', ['to-string', ['get', 'media_count']]],
              'text-size': 9,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-offset': [0.8, -0.8],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#14B8A6',
              'text-halo-color': '#0f172a',
              'text-halo-width': 1.5,
            },
          });

          map.on('click', 'matched-media-markers', handleMatchedMediaClick);
        }

        const unmatchedCount = unmatchedData.features?.length || 0;
        const matchedCount = matchedData.features?.length || 0;
        setStatus(unmatchedCount > 0 || matchedCount > 0 ? 'active' : 'empty');
      } catch (err) {
        if (!active) {
          return;
        }
        console.error('Failed to load media locations', err);
        setStatus('error');
      }
    };

    loadMediaLocations();

    return () => {
      active = false;
      map.off('click', 'media-location-markers', handleUnmatchedMediaClick);
      map.off('click', 'matched-media-markers', handleMatchedMediaClick);
      cleanupLayersAndSources();
    };
  }, [mapReady, mapRef, mapboxRef, showMediaLocations, mapStyle]);

  return status;
};
