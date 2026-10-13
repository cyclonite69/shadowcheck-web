import { useEffect } from 'react';
import type { Map, MapMouseEvent, MapboxGeoJSONFeature, Popup } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { AlprCameraProperties } from '../../../api/agencyApi';
import { renderAlprPopupCard } from '../../hooks/useAlprCameras';
import {
  renderWigleNetworkPopupCard,
  renderWigleObservationPopupCard,
} from '../../../utils/geospatial/renderMapPopupCards';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';
import { getPopupAnchor } from '../../../utils/geospatial/popupAnchor';
import {
  cleanupPopupDrag,
  setupPopupDrag,
  type PopupDragState,
} from '../../../utils/geospatial/setupPopupDrag';
import {
  applyGeospatialLayerVisibility,
  ensureGeospatialAlprMvtLayer,
  ensureGeospatialFieldDataMvtLayer,
  ensureKmlMvtLayer,
  ensureShotspotterMvtLayers,
  ensureWigleV2MvtLayer,
  ensureWigleV3MvtLayer,
  type GeospatialMvtLayerVisibility,
} from './mapLayers';

const INTERACTIVE_LAYER_IDS = [
  'geospatial-field-mvt-points',
  'geospatial-wigle-v2-mvt-points',
  'geospatial-wigle-v3-mvt-points',
  'geospatial-kml-mvt-points',
  'geospatial-alpr-mvt-points',
  'geospatial-shotspotter-zone-fill',
  'geospatial-shotspotter-sensor-points',
];

type FeatureProperties = Record<string, unknown>;

function stringProperty(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function propertiesFor(feature: MapboxGeoJSONFeature): FeatureProperties {
  return (feature.properties ?? {}) as FeatureProperties;
}

function renderNetworkFeature(
  layerId: string,
  properties: FeatureProperties,
  coordinates: [number, number]
): string {
  const bssid = properties.bssid ?? properties.netid;
  const ssid = properties.ssid ?? properties.name;
  const signal = properties.signal ?? properties.signal_dbm ?? properties.level;
  const raw = {
    ...properties,
    bssid,
    netid: properties.netid ?? bssid,
    ssid,
    name: properties.name ?? ssid,
    signal,
    level: properties.level ?? signal,
    radio_type: properties.radio_type ?? properties.network_type ?? properties.type,
    capabilities: properties.capabilities ?? properties.encryption,
    wigle_source:
      layerId === 'geospatial-wigle-v2-mvt-points'
        ? 'wigle-v2'
        : layerId === 'geospatial-wigle-v3-mvt-points'
          ? 'wigle-v3'
          : properties.wigle_source,
  };
  return renderNetworkTooltip(normalizeTooltipData(raw, coordinates));
}

function renderAlprFeature(properties: FeatureProperties, coordinates: [number, number]): string {
  const osmId = stringProperty(properties.osm_id ?? properties.id) ?? '';
  const alprProperties: AlprCameraProperties = {
    id: osmId,
    osm_id: osmId,
    manufacturer: stringProperty(properties.manufacturer) ?? stringProperty(properties.vendor),
    direction: stringProperty(properties.direction),
    camera_type: stringProperty(properties.camera_type),
    surveillance_zone: stringProperty(properties.surveillance_zone),
    camera_mount: stringProperty(properties.camera_mount),
    operator: stringProperty(properties.operator),
    electricity: stringProperty(properties.electricity),
  };
  return renderAlprPopupCard(alprProperties, coordinates);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function renderShotspotterFeature(layerId: string, properties: FeatureProperties): string {
  const isZone = layerId === 'geospatial-shotspotter-zone-fill';
  const heading = isZone ? 'Acoustic Detection Zone' : 'Acoustic Detection Sensor';
  const details = isZone
    ? [
        ['Zone', properties.zone_name],
        ['City', properties.city],
        ['State', properties.state],
        ['Status', properties.contract_status],
      ]
    : [
        ['Sensor ID', properties.sensor_id],
        ['Status', properties.status],
      ];
  const rows = details
    .map(([label, value]) => {
      const text = stringProperty(value);
      return text
        ? `<div style="margin-top:5px;font-size:12px;color:#e2e8f0;"><span style="color:#94a3b8;">${label}:</span> ${escapeHtml(text)}</div>`
        : '';
    })
    .join('');

  return `
    <div style="background:linear-gradient(135deg,rgba(15,23,42,.97),rgba(10,15,30,.97));border:1px solid rgba(251,113,133,.4);border-left:4px solid #fb7185;border-radius:10px;padding:13px 15px;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.75);">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#fb7185;font-weight:700;">SoundThinking · ShotSpotter</div>
      <div style="margin-top:5px;font-size:14px;font-weight:600;">${heading}</div>
      ${rows}
    </div>`;
}

function renderFeatureCard(
  layerId: string,
  feature: MapboxGeoJSONFeature,
  coordinates: [number, number]
): string {
  const properties = propertiesFor(feature);
  switch (layerId) {
    case 'geospatial-alpr-mvt-points':
      return renderAlprFeature(properties, coordinates);
    case 'geospatial-wigle-v2-mvt-points':
      return renderWigleNetworkPopupCard(
        {
          ssid: stringProperty(properties.ssid),
          name: stringProperty(properties.name),
          bssid: stringProperty(properties.bssid ?? properties.netid),
          last_seen: stringProperty(properties.last_seen),
          encryption: stringProperty(properties.encryption),
          channel: stringProperty(properties.channel),
          type: stringProperty(properties.type),
        },
        coordinates
      );
    case 'geospatial-wigle-v3-mvt-points':
      return renderWigleObservationPopupCard(
        {
          ssid: stringProperty(properties.ssid),
          bssid: stringProperty(properties.bssid ?? properties.netid),
          observed_at: stringProperty(properties.observed_at),
          signal: stringProperty(properties.signal),
          channel: stringProperty(properties.channel),
          frequency: stringProperty(properties.frequency),
        },
        coordinates
      );

    case 'geospatial-shotspotter-zone-fill':
    case 'geospatial-shotspotter-sensor-points':
      return renderShotspotterFeature(layerId, properties);
    default:
      return renderNetworkFeature(layerId, properties, coordinates);
  }
}

function showFeaturePopup(
  map: Map,
  mapboxgl: typeof mapboxglType,
  event: MapMouseEvent & { features?: MapboxGeoJSONFeature[] },
  layerId: string
) {
  const feature = event.features?.[0];
  if (!feature || !event.lngLat) {
    return;
  }

  const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];
  const html = renderFeatureCard(layerId, feature, coordinates);
  const popup = new mapboxgl.Popup({
    anchor: getPopupAnchor(map, event.lngLat, html),
    offset: 15,
    className: 'sc-popup',
    maxWidth: 'min(360px, 90vw)',
    focusAfterOpen: false,
    closeOnClick: true,
    closeButton: false,
  })
    .setLngLat(event.lngLat)
    .setHTML(html)
    .addTo(map);

  const dragState: PopupDragState = setupPopupDrag(popup, () => {});
  const originalRemove = popup.remove.bind(popup);
  popup.remove = function (): Popup {
    cleanupPopupDrag(popup, dragState);
    return originalRemove();
  };
}

export function attachGeospatialMvtInteractions(
  map: Map,
  mapboxgl: typeof mapboxglType
): () => void {
  const handlers = INTERACTIVE_LAYER_IDS.map((id) => {
    const enter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const leave = () => {
      map.getCanvas().style.cursor = '';
    };
    const click = (event: MapMouseEvent & { features?: MapboxGeoJSONFeature[] }) =>
      showFeaturePopup(map, mapboxgl, event, id);
    map.on('mouseenter', id, enter);
    map.on('mouseleave', id, leave);
    map.on('click', id, click);
    return { id, enter, leave, click };
  });

  return () => {
    handlers.forEach(({ id, enter, leave, click }) => {
      map.off('mouseenter', id, enter);
      map.off('mouseleave', id, leave);
      map.off('click', id, click);
    });
    map.getCanvas().style.cursor = '';
  };
}

export function useGeospatialMenuMvtLayers({
  mapRef,
  mapboxRef,
  mapReady,
  visible,
}: {
  mapRef: React.MutableRefObject<Map | null>;
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>;
  mapReady: boolean;
  visible: GeospatialMvtLayerVisibility;
}) {
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReady) {
      return;
    }

    let detachInteractions = () => {};
    const syncLayers = () => {
      if (!map.isStyleLoaded()) {
        return;
      }
      ensureGeospatialFieldDataMvtLayer(map);
      ensureWigleV2MvtLayer(map);
      ensureWigleV3MvtLayer(map);
      ensureKmlMvtLayer(map);
      ensureGeospatialAlprMvtLayer(map);
      ensureShotspotterMvtLayers(map);
      applyGeospatialLayerVisibility(map, visible);
      detachInteractions();
      detachInteractions = attachGeospatialMvtInteractions(map, mapboxgl);
    };

    syncLayers();
    map.on('style.load', syncLayers);
    return () => {
      map.off('style.load', syncLayers);
      detachInteractions();
    };
  }, [
    mapboxRef,
    mapReady,
    mapRef,
    visible.alpr,
    visible.fieldObservations,
    visible.kml,
    visible.shotspotterSensors,
    visible.shotspotterZones,
    visible.wigleV2,
    visible.wigleV3,
  ]);
}
