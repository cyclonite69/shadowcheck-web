import type { Map, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { formatSecurity } from '../../utils/wigle';
import { renderNetworkTooltip } from '../../utils/geospatial/renderNetworkTooltip';

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

    const tooltipHTML = renderNetworkTooltip({
      ssid: props.ssid,
      bssid: props.bssid,
      type: props.type,
      security: formatSecurity(props.encryption),
      frequency: props.frequency,
      channel: props.channel,
      time: props.lasttime,
      first_seen: props.firsttime,
      last_seen: props.lasttime,
      lat: e.lngLat.lat,
      lon: e.lngLat.lng,
      accuracy: props.accuracy,
      threat_level: 'NONE',
      threat_score: 0,
    });

    new mapboxgl.Popup({ offset: 12, className: 'sc-popup', maxWidth: '340px' })
      .setLngLat(e.lngLat)
      .setHTML(tooltipHTML)
      .addTo(map);
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

  map.on('click', 'wigle-v2-unclustered', handleUnclustered);
  map.on('click', 'wigle-v3-unclustered', handleUnclustered);
  map.on('click', 'wigle-v2-clusters', handleClusterClick('wigle-v2-points', 'wigle-v2-clusters'));
  map.on('click', 'wigle-v3-clusters', handleClusterClick('wigle-v3-points', 'wigle-v3-clusters'));

  wigleHandlersAttachedRef.current = true;
};
