import { useCallback, useRef } from 'react';
import type { Map as MapboxMap, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';
import { getPopupAnchor } from '../../../utils/geospatial/popupAnchor';
import { popupStateManager } from '../../../utils/geospatial/popupStateManager';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../../utils/geospatial/setupPopupDrag';

export const useMapPopups = (_mapRef: any, mapboxRef: any) => {
  const dragStateRef = useRef<PopupDragState | null>(null);

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
          closeButton: false,
          focusAfterOpen: false,
        })
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map);

        // Register this popup and close any previous one (single tooltip at a time)
        popupStateManager.setActive(popup);

        // Setup drag functionality
        dragStateRef.current = setupPopupDrag(popup, (_offset) => {
          // Drag handler (tether line removed)
        });

        // Cleanup on popup close
        const originalRemove = popup.remove.bind(popup);
        popup.remove = function () {
          if (dragStateRef.current) {
            cleanupPopupDrag(popup, dragStateRef.current);
            dragStateRef.current = null;
          }
          popupStateManager.closeIfActive(popup);
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
