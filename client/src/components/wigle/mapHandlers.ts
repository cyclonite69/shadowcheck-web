import type { Map, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import { renderNetworkTooltip } from '../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../utils/geospatial/tooltipDataNormalizer';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';

export const attachClickHandlers = (
  map: Map,
  mapboxgl: typeof mapboxglType,
  wigleHandlersAttachedRef: React.MutableRefObject<boolean>
) => {
  if (wigleHandlersAttachedRef.current) return;

  const handleUnclustered = (e: any) => {
    const feature = e.features && e.features[0];
    const props = feature?.properties;
    if (!props || !e.lngLat) return;

    // Determine type code for normalizer
    const rawType = String(props.type || '').toLowerCase();
    const typeCode =
      rawType === 'wifi'
        ? 'W'
        : rawType === 'gsm'
          ? 'G'
          : rawType === 'lte'
            ? 'L'
            : rawType === 'ble'
              ? 'E'
              : rawType === 'bt'
                ? 'B'
                : props.type;

    const normalizedData = normalizeTooltipData(
      {
        ...props,
        type: typeCode,
        threat_level: props.threat_level || 'NONE',
        threat_score: props.threat_score || 0,
      },
      [e.lngLat.lng, e.lngLat.lat]
    );

    const tooltipHTML = renderNetworkTooltip(normalizedData);
    const anchor = getPopupAnchor(map, e.lngLat, tooltipHTML);

    const popup = new mapboxgl.Popup({
      anchor,
      offset: 15,
      className: 'sc-popup',
      maxWidth: 'min(340px, 90vw)',
      focusAfterOpen: false,
    })
      .setLngLat(e.lngLat)
      .setHTML(tooltipHTML)
      .addTo(map);

    // Setup drag and tether
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

  const handleClusterClick = (sourceId: string, clusterLayerId: string) => (e: any) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
    const clusterId = features[0]?.properties?.cluster_id;
    const source = map.getSource(sourceId) as GeoJSONSource;
    if (!source || clusterId == null) return;
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return;
      map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
    });
  };

  const handleKmlClick = (e: any) => {
    const feature = e.features && e.features[0];
    const props = feature?.properties;
    if (!props || !e.lngLat) return;

    const observedAt = props.observed_at ? new Date(props.observed_at).toLocaleString() : 'Unknown';
    const html = `
      <div style="min-width:220px;color:#e2e8f0;font:12px/1.45 system-ui,sans-serif">
        <div style="font-weight:700;color:#fb923c;margin-bottom:8px">KML Point</div>
        <div><strong>BSSID:</strong> ${props.bssid || 'Unknown'}</div>
        <div><strong>Name:</strong> ${props.ssid || 'Unknown'}</div>
        <div><strong>Type:</strong> ${props.type || 'Unknown'}</div>
        <div><strong>Observed:</strong> ${observedAt}</div>
        <div><strong>Signal:</strong> ${props.signal_dbm ?? 'Unknown'}</div>
        <div><strong>Accuracy:</strong> ${props.accuracy ?? 'Unknown'}</div>
        <div style="margin-top:6px;color:#94a3b8;word-break:break-all"><strong>Source:</strong> ${props.source_file || 'Unknown'}</div>
      </div>
    `;

    new mapboxgl.Popup({
      anchor: getPopupAnchor(map, e.lngLat, html),
      offset: 15,
      className: 'sc-popup',
      maxWidth: 'min(340px, 90vw)',
      focusAfterOpen: false,
    })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);
  };

  map.on('click', 'wigle-v2-unclustered', handleUnclustered);
  map.on('click', 'wigle-v3-unclustered', handleUnclustered);
  map.on('click', 'wigle-kml-unclustered', handleKmlClick);
  map.on('click', 'wigle-v2-clusters', handleClusterClick('wigle-v2-points', 'wigle-v2-clusters'));
  map.on('click', 'wigle-v3-clusters', handleClusterClick('wigle-v3-points', 'wigle-v3-clusters'));
  map.on(
    'click',
    'wigle-kml-clusters',
    handleClusterClick('wigle-kml-points', 'wigle-kml-clusters')
  );

  wigleHandlersAttachedRef.current = true;
};
