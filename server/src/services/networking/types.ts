export type SortEntry = {
  column: string;
  direction: 'ASC' | 'DESC';
};

export type AppliedFilter = {
  column: string;
  value?: unknown;
  range?: [number, number];
};

export type NetworkFilterOptions = {
  limit: number;
  offset: number;
  planCheck: boolean;
  locationMode: string;
  sort: unknown;
  order: unknown;
  threatLevel: string | null;
  threatCategories: string[] | null;
  threatScoreMin: number | null;
  threatScoreMax: number | null;
  lastSeen: string | null;
  distanceFromHomeKm: number | null;
  distanceFromHomeMinKm: number | null;
  distanceFromHomeMaxKm: number | null;
  minSignal: number | null;
  maxSignal: number | null;
  minObsCount: number | null;
  maxObsCount: number | null;
  ssidPattern: string | null;
  bssidList: string[] | null;
  radioTypes: string[] | null;
  encryptionTypes: string[] | null;
  authMethods: string[] | null;
  insecureFlags: string[] | null;
  securityFlags: string[] | null;
  quickSearchPattern: string | null;
  manufacturer: string | null;
  bboxMinLat: number | null;
  bboxMaxLat: number | null;
  bboxMinLng: number | null;
  bboxMaxLng: number | null;
  radiusCenterLat: number | null;
  radiusCenterLng: number | null;
  radiusMeters: number | null;
};

export type NetworkQueryParts = {
  columnsWithDistance: string[];
  joins: string[];
  conditions: string[];
  params: unknown[];
  paramIndex: number;
  appliedFilters: AppliedFilter[];
};
