/**
 * WiGLE Map Event Handlers
 * Click handlers for clusters and unclustered points
 */

import type { Map, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderNetworkTooltip } from '../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../utils/geospatial/tooltipDataNormalizer';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

export function createUnclusteredClickHandler(mapboxgl: typeof mapboxglType) {
  return (e: any) => {
    const feature = e.features && e.features[0];
    const props = feature?.properties;
    if (!props || !e.lngLat) return;

    const tooltipHTML = renderNetworkTooltip(
      normalizeTooltipData(
        {
          ...props,
          threat_level: 'NONE',
          threat_score: 0,
        },
        [e.lngLat.lng, e.lngLat.lat]
      )
    );

    const anchor = getPopupAnchor(e.target, e.lngLat, tooltipHTML);

    const popup = new mapboxgl.Popup({
      anchor,
      offset: 15,
      className: 'sc-popup',
      maxWidth: '340px',
    })
      .setLngLat(e.lngLat)
      .setHTML(tooltipHTML)
      .addTo(e.target);

    // Setup drag and tether
    const map = e.target as Map;
    let dragState: PopupDragState | null = null;
    let pinCleanup: (() => void) | null = null;

    dragState = setupPopupDrag(popup, (offset) => {
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
}

export function createClusterClickHandler(map: Map, sourceId: string, clusterLayerId: string) {
  return (e: any) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
    const clusterId = features[0]?.properties?.cluster_id;
    const source = map.getSource(sourceId) as GeoJSONSource;
    if (!source || clusterId == null) return;

    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return;
      map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
    });
  };
}

export function attachWigleClickHandlers(map: Map, mapboxgl: typeof mapboxglType) {
  const handleUnclustered = createUnclusteredClickHandler(mapboxgl);

  map.on('click', 'wigle-v2-unclustered', handleUnclustered);
  map.on('click', 'wigle-v3-unclustered', handleUnclustered);
  map.on(
    'click',
    'wigle-v2-clusters',
    createClusterClickHandler(map, 'wigle-v2-points', 'wigle-v2-clusters')
  );
  map.on(
    'click',
    'wigle-v3-clusters',
    createClusterClickHandler(map, 'wigle-v3-points', 'wigle-v3-clusters')
  );
}
