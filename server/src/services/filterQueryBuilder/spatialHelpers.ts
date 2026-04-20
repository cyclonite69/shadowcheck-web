/**
 * Spatial query helpers to optimize index usage.
 */
export const getSpatialBoundingBoxFragment = (
  lat: number,
  lon: number,
  radiusMeters: number,
  geomColumn: string = 'geom'
): string => {
  // Rough bounding box in degrees (1 degree ~ 111km)
  const deg = radiusMeters / 111000;
  return `${geomColumn} && ST_MakeEnvelope(${lon - deg}, ${lat - deg}, ${lon + deg}, ${lat + deg}, 4326)`;
};
