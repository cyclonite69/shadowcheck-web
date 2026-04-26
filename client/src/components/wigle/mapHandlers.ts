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
            wigle_v2_firsttime: wigle.wigle_v2_firsttime,
            wigle_v2_lasttime: wigle.wigle_v2_lasttime,
            wigle_v2_lastupdt: wigle.wigle_v2_lastupdt,
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
            // Most-recent WiGLE observation detail
            recent_ssid: (wigle.recent_ssid as string | null) ?? null,
            recent_channel: (wigle.recent_channel as number | null) ?? null,
            recent_frequency: (wigle.recent_frequency as number | null) ?? null,
            recent_accuracy: (wigle.recent_accuracy as number | null) ?? null,
            geocoded_address: (wigle.geocoded_address as string | null) ?? null,
            // Local linkage — ONLY these fields from local data
            wigle_match: localLinkage.has_local_match,
            local_observations: localLinkage.local_observation_count,
            local_first_seen: localLinkage.local_first_seen,
            local_last_seen: localLinkage.local_last_seen,
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
      <div style="width:288px;max-width:min(340px,90vw);background:#1a1d23;border:2px solid #60a5fa;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#e2e8f0;box-sizing:border-box;padding:10px 12px;">
        <div style="font-weight:700;font-size:13px;color:#fb923c;margin-bottom:8px;">KML Point</div>
        <div style="font-size:11px;display:flex;flex-direction:column;gap:4px;">
          <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">BSSID</span><br><span style="font-family:monospace;color:#60a5fa;">${props.bssid || '&mdash;'}</span></div>
          <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Name</span><br>${props.ssid || '&mdash;'}</div>
          <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Type</span><br>${props.type || '&mdash;'}</div>
          <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Observed</span><br>${observedAt}</div>
          <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Signal</span><br>${props.signal_dbm ?? '&mdash;'}</div>
          <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Accuracy</span><br>${props.accuracy ?? '&mdash;'}</div>
          <div style="margin-top:4px;color:#94a3b8;word-break:break-all;"><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Source</span><br>${props.source_file || '&mdash;'}</div>
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({
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

    if (props.bssid) {
      void fetch(`/api/wigle/kml-bssid-summary?bssid=${encodeURIComponent(String(props.bssid))}`)
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (
            data: {
              observation_count: number;
              first_seen: string | null;
              last_seen: string | null;
              timespan_days: number | null;
            } | null
          ) => {
            if (!popup.isOpen() || !data) return;

            const lbl = (t: string) =>
              `<span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">${t}</span>`;

            const enrichRows: string[] = [
              `<div>${lbl('KML Records')}<br>${data.observation_count}</div>`,
            ];

            if (data.first_seen) {
              enrichRows.push(
                `<div>${lbl('First Seen')}<br>${new Date(data.first_seen).toLocaleDateString()}</div>`
              );
            }
            if (data.last_seen) {
              enrichRows.push(
                `<div>${lbl('Last Seen')}<br>${new Date(data.last_seen).toLocaleDateString()}</div>`
              );
            }
            if (data.timespan_days != null) {
              enrichRows.push(
                `<div>${lbl('Timespan')}<br>${Math.round(data.timespan_days)} days</div>`
              );
            }

            const enrichedHtml = `
              <div style="width:288px;max-width:min(340px,90vw);background:#1a1d23;border:2px solid #60a5fa;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#e2e8f0;box-sizing:border-box;padding:10px 12px;">
                <div style="font-weight:700;font-size:13px;color:#fb923c;margin-bottom:8px;">KML Point</div>
                <div style="font-size:11px;display:flex;flex-direction:column;gap:4px;">
                  <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">BSSID</span><br><span style="font-family:monospace;color:#60a5fa;">${props.bssid || '&mdash;'}</span></div>
                  <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Name</span><br>${props.ssid || '&mdash;'}</div>
                  <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Type</span><br>${props.type || '&mdash;'}</div>
                  <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Observed</span><br>${observedAt}</div>
                  <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Signal</span><br>${props.signal_dbm ?? '&mdash;'}</div>
                  <div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Accuracy</span><br>${props.accuracy ?? '&mdash;'}</div>
                  <div style="margin-top:4px;color:#94a3b8;word-break:break-all;"><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);">Source</span><br>${props.source_file || '&mdash;'}</div>
                  <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:4px;">
                    ${enrichRows.join('')}
                  </div>
                </div>
              </div>
            `;

            popup.setHTML(enrichedHtml);
          }
        )
        .catch(() => {
          // Leave original content on failure.
        });
    }
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
