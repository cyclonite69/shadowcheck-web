/**
 * WiGLE Map Event Handlers
 * Click handlers for clusters and unclustered points
 */

import type { Map, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderNetworkTooltip } from '../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../utils/geospatial/tooltipDataNormalizer';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import { networkApi } from '../../api/networkApi';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';

export function createUnclusteredClickHandler(mapboxgl: typeof mapboxglType) {
  return (e: any) => {
    const feature = e.features && e.features[0];
    const props = feature?.properties;
    if (!props || !e.lngLat) return;

    const map = e.target as Map;
    const bssid = String(props.netid || props.bssid || '');
    const ssid = props.ssid || props.netid || '';

    const placeholderHTML = `
      <div style="min-width:200px;padding:10px 12px;font:12px/1.5 system-ui,sans-serif;color:#e2e8f0">
        <div style="font-weight:700;color:#60a5fa;margin-bottom:4px">${ssid || bssid || 'Network'}</div>
        <div style="color:#94a3b8;font-size:11px">${bssid}</div>
        <div style="margin-top:8px;color:#64748b;font-size:11px">Loading full data…</div>
      </div>`;

    const anchor = getPopupAnchor(map, e.lngLat, placeholderHTML);
    const popup = new mapboxgl.Popup({
      anchor,
      offset: 15,
      className: 'sc-popup',
      maxWidth: '340px',
      closeOnClick: true,
      closeButton: false,
    })
      .setLngLat(e.lngLat)
      .setHTML(placeholderHTML)
      .addTo(map);

    if (bssid) {
      networkApi.getNetworkByBssid(bssid).then((mvData) => {
        if (!popup.isOpen()) return;
        const source = mvData ?? { ...props, bssid };
        const normalized = normalizeTooltipData(source, [e.lngLat.lng, e.lngLat.lat]);
        const fullHTML = renderNetworkTooltip({
          ...normalized,
          triggerElement: map.getContainer(),
        });
        popup.setHTML(fullHTML ?? placeholderHTML);
      });
    }

    // Setup drag
    let dragState: PopupDragState | null = null;

    dragState = setupPopupDrag(popup, (_offset) => {
      // Drag handler (tether line removed)
    });

    // Cleanup on popup close
    const originalRemove = popup.remove.bind(popup);
    popup.remove = function () {
      if (dragState) {
        cleanupPopupDrag(popup, dragState);
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
