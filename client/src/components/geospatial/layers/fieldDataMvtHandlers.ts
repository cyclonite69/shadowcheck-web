import type { Map, MapMouseEvent, MapboxGeoJSONFeature, Popup as MapboxPopup } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { getPopupAnchor } from '../../../utils/geospatial/popupAnchor';
import {
  cleanupPopupDrag,
  setupPopupDrag,
  type PopupDragState,
} from '../../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../../utils/geospatial/setupPopupPin';

const FIELD_DATA_MVT_LAYER = 'wigle-field-mvt-points';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character
  );
}

function stringProperty(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function parseSignalLevel(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Render an escaped popup card for one field observation tile feature. */
export function renderFieldDataPopupCard(
  props: Record<string, unknown>,
  coordinates: [number, number]
): string {
  const level = parseSignalLevel(props.level);
  const rssiColor =
    level === null ? '#94a3b8' : level >= -65 ? '#10b981' : level >= -80 ? '#f59e0b' : '#ef4444';
  const bssid = escapeHtml(stringProperty(props.bssid) ?? 'UNKNOWN');
  const ssid = escapeHtml(stringProperty(props.ssid) ?? '<Hidden SSID>');
  const radio = escapeHtml(stringProperty(props.radio_type) ?? 'Wi-Fi');
  const id = escapeHtml(stringProperty(props.id) ?? 'N/A');
  const signal = level === null ? '' : `${level} dBm`;
  const location = `${coordinates[1]}, ${coordinates[0]}`;

  return `
    <div style="background:#0f172a;border:1px solid #06b6d444;border-radius:10px;padding:12px 14px;min-width:220px;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:ui-monospace, monospace;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#06b6d4;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Observation</span>
        <span style="color:${rssiColor};font-size:12px;font-weight:700;">${signal}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ssid}</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">${bssid}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#cbd5e1;border-top:1px solid #1e293b;padding-top:6px;">
        <span>Radio: <strong style="color:#f8fafc;">${radio}</strong></span>
        <span>ID: <strong style="color:#f8fafc;">${id}</strong></span>
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-top:5px;">${escapeHtml(location)}</div>
    </div>
  `;
}

/** Attach hover and popup interactions to the field-observation vector-tile layer. */
export function attachFieldDataMvtHandlers(map: Map, mapboxgl: typeof mapboxglType): () => void {
  const handleMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const handleMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };
  const handleClick = (event: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) => {
    const feature = event.features?.[0];
    if (!feature || !event.lngLat) {
      return;
    }

    const properties = feature.properties ?? {};
    const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];
    const html = renderFieldDataPopupCard(properties, coordinates);
    const popup = new mapboxgl.Popup({
      anchor: getPopupAnchor(map, event.lngLat, html),
      offset: 12,
      className: 'sc-popup',
      maxWidth: '300px',
      focusAfterOpen: false,
    })
      .setLngLat(event.lngLat)
      .setHTML(html)
      .addTo(map);

    const dragState: PopupDragState = setupPopupDrag(popup, () => {});
    const pinCleanup = setupPopupPin(popup, map);
    const originalRemove = popup.remove.bind(popup);
    popup.remove = function (): MapboxPopup {
      cleanupPopupDrag(popup, dragState);
      pinCleanup();
      return originalRemove();
    };
  };

  map.on('mouseenter', FIELD_DATA_MVT_LAYER, handleMouseEnter);
  map.on('mouseleave', FIELD_DATA_MVT_LAYER, handleMouseLeave);
  map.on('click', FIELD_DATA_MVT_LAYER, handleClick);

  return () => {
    map.off('mouseenter', FIELD_DATA_MVT_LAYER, handleMouseEnter);
    map.off('mouseleave', FIELD_DATA_MVT_LAYER, handleMouseLeave);
    map.off('click', FIELD_DATA_MVT_LAYER, handleClick);
  };
}
