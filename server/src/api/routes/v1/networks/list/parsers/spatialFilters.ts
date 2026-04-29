import {
  parseOptionalNumber,
  parseBoundingBoxParams,
  parseRadiusParams,
} from '../../../../../../validation/parameterParsers';

export type SpatialFilterParams = {
  locationMode: string;
  distanceFromHomeKm: number | null;
  distanceFromHomeMinKm: number | null;
  distanceFromHomeMaxKm: number | null;
  bboxMinLat: number | null;
  bboxMaxLat: number | null;
  bboxMinLng: number | null;
  bboxMaxLng: number | null;
  radiusCenterLat: number | null;
  radiusCenterLng: number | null;
  radiusMeters: number | null;
};

const VALID_LOCATION_MODES = [
  'latest_observation',
  'centroid',
  'weighted_centroid',
  'triangulated',
];

export const parseSpatialFilters = (
  locationModeRaw: string,
  distanceRaw: unknown,
  distanceMinRaw: unknown,
  distanceMaxRaw: unknown,
  bboxMinLatRaw: unknown,
  bboxMaxLatRaw: unknown,
  bboxMinLngRaw: unknown,
  bboxMaxLngRaw: unknown,
  radiusCenterLatRaw: unknown,
  radiusCenterLngRaw: unknown,
  radiusMetersRaw: unknown
): { ok: true; params: SpatialFilterParams } | { ok: false; status: 400; error: string } => {
  const locationMode = VALID_LOCATION_MODES.includes(locationModeRaw)
    ? locationModeRaw
    : 'latest_observation';

  const distanceResult = parseOptionalNumber(
    distanceRaw,
    0,
    Number.MAX_SAFE_INTEGER,
    'distance_from_home_km'
  );
  if (!distanceResult.ok) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid distance_from_home_km parameter. Must be >= 0.',
    };
  }

  const distanceMinResult = parseOptionalNumber(
    distanceMinRaw,
    0,
    Number.MAX_SAFE_INTEGER,
    'distance_from_home_km_min'
  );
  if (!distanceMinResult.ok) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid distance_from_home_km_min parameter. Must be >= 0.',
    };
  }

  const distanceMaxResult = parseOptionalNumber(
    distanceMaxRaw,
    0,
    Number.MAX_SAFE_INTEGER,
    'distance_from_home_km_max'
  );
  if (!distanceMaxResult.ok) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid distance_from_home_km_max parameter. Must be >= 0.',
    };
  }

  const bboxResult = parseBoundingBoxParams(
    bboxMinLatRaw,
    bboxMaxLatRaw,
    bboxMinLngRaw,
    bboxMaxLngRaw
  );
  const radiusResult = parseRadiusParams(radiusCenterLatRaw, radiusCenterLngRaw, radiusMetersRaw);

  return {
    ok: true,
    params: {
      locationMode,
      distanceFromHomeKm: distanceResult.value,
      distanceFromHomeMinKm: distanceMinResult.value,
      distanceFromHomeMaxKm: distanceMaxResult.value,
      bboxMinLat: bboxResult.value?.minLat ?? null,
      bboxMaxLat: bboxResult.value?.maxLat ?? null,
      bboxMinLng: bboxResult.value?.minLng ?? null,
      bboxMaxLng: bboxResult.value?.maxLng ?? null,
      radiusCenterLat: radiusResult.value?.centerLat ?? null,
      radiusCenterLng: radiusResult.value?.centerLng ?? null,
      radiusMeters: radiusResult.value?.radius ?? null,
    },
  };
};
