/**
 * Spatial query helpers to optimize index usage.
 */
export const getSpatialBoundingBoxFragment = (
  lat: number,
  lon: number,
  radiusMeters: number,
  geomColumn: string = 'geom'
): string => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusMeters)) {
    throw new TypeError(
      'getSpatialBoundingBoxFragment requires finite latitude, longitude, and radiusMeters values.'
    );
  }
  if (radiusMeters <= 0) {
    throw new TypeError(
      'getSpatialBoundingBoxFragment requires radiusMeters to be greater than 0.'
    );
  }

  // Conservative minimum meters-per-degree of latitude (~WGS84 meridional).
  const latHalfDeg = radiusMeters / 110574;
  const south = lat - latHalfDeg;
  const north = lat + latHalfDeg;

  // Near the poles the geodesic circle spans all longitudes; keep a latitude-only envelope.
  // Antimeridian wrapping is intentionally unchanged for non-polar cases (caller may emit
  // west/east outside [-180, 180]; ST_MakeEnvelope behavior there is pre-existing).
  let west: number;
  let east: number;
  if (Math.abs(lat) + latHalfDeg >= 89) {
    west = -180;
    east = 180;
  } else {
    // Longitude degrees shrink with cos(lat); evaluate cos at the circle's most poleward
    // edge where the longitude extent peaks.
    const polewardLat = Math.min(89.9, Math.abs(lat) + latHalfDeg);
    const lonHalfDeg = radiusMeters / (111320 * Math.cos((polewardLat * Math.PI) / 180));
    west = lon - lonHalfDeg;
    east = lon + lonHalfDeg;
  }

  return `${geomColumn} && ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`;
};
