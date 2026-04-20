import type { Map, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  getWiglePageNetwork,
  type WiglePageNetwork,
  type WiglePageNetworkResponse,
} from '../../api/wigleApi';
import { normalizeWigleTooltipData } from '../../utils/wigle/wigleTooltipNormalizer';
import { renderWigleTooltip } from '../../utils/wigle/wigleTooltipRenderer';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';

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

    const netid = String(props.netid || props.bssid || '');
    const featureData: WiglePageNetwork = {
      ...(props as Record<string, unknown>),
      netid: String(props.netid || props.bssid || ''),
      bssid: String(props.bssid || props.netid || ''),
      trilat: props.trilat ?? props.latitude ?? e.lngLat.lat,
      trilong: props.trilong ?? props.trilon ?? props.longitude ?? e.lngLat.lng,
      wigle_source: props.wigle_source === 'wigle-v3' ? 'wigle-v3' : 'wigle-v2',
    };
    const initialHTML = renderWigleTooltip(normalizeWigleTooltipData(featureData));

    const anchor = getPopupAnchor(map, e.lngLat, initialHTML);
    const popup = new mapboxgl.Popup({
      anchor,
      offset: 15,
      className: 'sc-popup',
      maxWidth: 'min(340px, 90vw)',
      focusAfterOpen: false,
      closeOnClick: true,
      closeButton: false,
    })
      .setLngLat(e.lngLat)
      .setHTML(initialHTML)
      .addTo(map);

    if (netid) {
      void getWiglePageNetwork(netid)
        .then((pageResponse: WiglePageNetworkResponse) => {
          if (!popup.isOpen() || !pageResponse) return;

          const { wigle, localLinkage } = pageResponse;

          // Build merged object: WiGLE-truth fields from structured `wigle` section only.
          // Local linkage maps to the existing flat fields the normalizer already reads.
          const mergedData: WiglePageNetwork = {
            ...featureData,
            bssid: wigle.bssid,
            netid: wigle.bssid,
            ssid: wigle.ssid,
            name: wigle.name,
            type: wigle.type,
            encryption: wigle.encryption,
            capabilities: wigle.encryption,
            channel: wigle.channel,
            frequency: wigle.frequency,
            comment: wigle.comment,
            wigle_source: wigle.wigle_source,
            // Temporal: v3-derived from observations when available, else v2 summary
            firsttime: wigle.wigle_v3_first_seen ?? wigle.wigle_v2_firsttime,
            lasttime: wigle.wigle_v3_last_seen ?? wigle.wigle_v2_lasttime,
            // New v3 temporal fields for obs-count display
            wigle_v3_first_seen: wigle.wigle_v3_first_seen,
            wigle_v3_last_seen: wigle.wigle_v3_last_seen,
            wigle_v3_observation_count: wigle.wigle_v3_observation_count,
            // Chosen display coordinate
            display_lat: wigle.display_lat,
            display_lon: wigle.display_lon,
            display_coordinate_source: wigle.display_coordinate_source,
            trilat: wigle.display_lat ?? featureData.trilat,
            trilong: wigle.display_lon ?? featureData.trilong,
            // v2 location fields
            city: wigle.wigle_v2_city,
            region: wigle.wigle_v2_region,
            road: wigle.wigle_v2_road,
            housenumber: wigle.wigle_v2_housenumber,
            // OUI-enriched manufacturer
            manufacturer: wigle.manufacturer,
            // Public-pattern signals
            public_nonstationary_flag: wigle.public_nonstationary_flag,
            public_ssid_variant_flag: wigle.public_ssid_variant_flag,
            wigle_precision_warning: wigle.wigle_precision_warning,
            // Local linkage — ONLY these fields from local data
            wigle_match: localLinkage.has_local_match,
            local_observations: localLinkage.local_observation_count,
          };

          popup.setHTML(renderWigleTooltip(normalizeWigleTooltipData(mergedData)));
        })
        .catch(() => {
          // Feature props remain the source of truth if enrichment fails.
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
      closeOnClick: true,
      closeButton: false,
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

  // Crosshair cursor over clickable points so users know exactly where to click
  const POINT_LAYERS = ['wigle-v2-unclustered', 'wigle-v3-unclustered', 'wigle-kml-unclustered'];
  POINT_LAYERS.forEach((layerId) => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'crosshair';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });

  wigleHandlersAttachedRef.current = true;
};
