import { useCallback } from 'react';
import type { Map as MapboxMap, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';
import { getPopupAnchor } from '../../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../../utils/geospatial/setupPopupPin';

export const useMapPopups = (
  mapRef: React.MutableRefObject<MapboxMap | null>,
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>
) => {
  const attachPopupHandlers = useCallback(
    (map: MapboxMap) => {
      const mapboxgl = mapboxRef.current;
      if (!mapboxgl) return;

      const handleClick = (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const coordinates = (feature.geometry as any).coordinates;
        const latitude = coordinates[1];
        const longitude = coordinates[0];

        const popupHTML = renderNetworkTooltip(
          normalizeTooltipData(
            {
              ...props,
              lat: latitude,
              lon: longitude,
            },
            [longitude, latitude]
          )
        );
        const anchor = getPopupAnchor(map, e.lngLat, popupHTML);

        const popup = new (mapboxgl as any).Popup({
          anchor,
          offset: 15,
          className: 'sc-popup',
          maxWidth: 'min(340px, 90vw)',
          closeOnClick: true,
          closeButton: true,
          focusAfterOpen: false,
        })
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map);

        // Cap tooltip height so it never scrolls on a normal viewport.
        // Do NOT override the popup's position — Mapbox positions it via the
        // computed anchor so it appears offset from the point, not over it.
        requestAnimationFrame(() => {
          const el = popup.getElement();
          if (!el) return;
          const containerRect = map.getContainer().getBoundingClientRect();
          const content = el.querySelector('.mapboxgl-popup-content') as HTMLElement | null;
          if (content) {
            content.style.maxHeight = `${Math.min(containerRect.height - 40, 520)}px`;
            content.style.overflowY = 'auto';
          }
        });

        // Setup drag functionality
        let dragState: PopupDragState | null = null;
        let pinCleanup: (() => void) | null = null;

        dragState = setupPopupDrag(popup, (_offset) => {
          // Drag handler (tether line removed)
        });

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

      map.on('click', 'observation-points', handleClick);

      return () => {
        map.off('click', 'observation-points', handleClick);
      };
    },
    [mapboxRef]
  );

  return { attachPopupHandlers };
};
