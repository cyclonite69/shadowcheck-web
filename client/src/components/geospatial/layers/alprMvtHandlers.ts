import type { Map, MapMouseEvent, MapboxGeoJSONFeature, Popup as MapboxPopup } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { AlprCameraProperties } from '../../../api/agencyApi';
import { renderAlprPopupCard } from '../../hooks/useAlprCameras';
import { getPopupAnchor } from '../../../utils/geospatial/popupAnchor';
import {
  cleanupPopupDrag,
  setupPopupDrag,
  type PopupDragState,
} from '../../../utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../../utils/geospatial/setupPopupPin';

const MVT_ALPR_LAYER = 'alpr-cameras-mvt-points';

function stringProperty(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function readAlprProperties(feature: MapboxGeoJSONFeature): AlprCameraProperties {
  const properties = feature.properties ?? {};
  const osmId = stringProperty(properties.osm_id) ?? '';
  return {
    id: osmId,
    osm_id: osmId,
    manufacturer: stringProperty(properties.manufacturer),
    direction: stringProperty(properties.direction),
    camera_type: stringProperty(properties.camera_type),
    surveillance_zone: stringProperty(properties.surveillance_zone),
    camera_mount: stringProperty(properties.camera_mount),
    operator: stringProperty(properties.operator),
    electricity: stringProperty(properties.electricity),
  };
}

/** Attach hover and popup interactions to the experimental ALPR vector-tile layer. */
export function attachAlprMvtHandlers(map: Map, mapboxgl: typeof mapboxglType): () => void {
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

    const html = renderAlprPopupCard(readAlprProperties(feature), [
      event.lngLat.lng,
      event.lngLat.lat,
    ]);
    const popup = new mapboxgl.Popup({
      anchor: getPopupAnchor(map, event.lngLat, html),
      offset: 15,
      className: 'sc-popup',
      maxWidth: '320px',
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

  map.on('mouseenter', MVT_ALPR_LAYER, handleMouseEnter);
  map.on('mouseleave', MVT_ALPR_LAYER, handleMouseLeave);
  map.on('click', MVT_ALPR_LAYER, handleClick);

  return () => {
    map.off('mouseenter', MVT_ALPR_LAYER, handleMouseEnter);
    map.off('mouseleave', MVT_ALPR_LAYER, handleMouseLeave);
    map.off('click', MVT_ALPR_LAYER, handleClick);
  };
}
