const { escapeLikePattern } = require('../../utils/escapeSQL');
const { NETWORK_CHANNEL_EXPR } = require('../filterQueryBuilder/sqlExpressions');
const {
  buildThreatScoreExpr,
  buildThreatLevelExpr,
  buildTypeExpr,
  buildDistanceExpr,
} = require('../../utils/networkSqlExpressions');

export {};

import type { NetworkFilterOptions, NetworkQueryParts } from './types';
import {
  applyLocationFilters,
  applySecurityAndRadioFilters,
  applyTextAndRangeFilters,
} from './filterBuilders';
import { getBaseJoins, getBaseSelectColumns, withDistanceColumn } from './querySchema';
import { createNetworkQueryState } from './queryState';

const buildNetworkQueryParts = (
  opts: NetworkFilterOptions,
  homeLocation: { lat: number; lon: number } | null,
  simpleRuleScoringEnabled: boolean
): {
  queryParts: NetworkQueryParts;
  channelExpr: string;
  threatLevelExpr: string;
} => {
  const {
    locationMode,
    threatLevel,
    threatCategories,
    threatScoreMin,
    threatScoreMax,
    lastSeen,
    distanceFromHomeKm,
    distanceFromHomeMinKm,
    distanceFromHomeMaxKm,
    minSignal,
    maxSignal,
    minObsCount,
    maxObsCount,
    ssidPattern,
    bssidList,
    radioTypes,
    encryptionTypes,
    authMethods,
    insecureFlags,
    securityFlags,
    quickSearchPattern,
    manufacturer,
    bboxMinLat,
    bboxMaxLat,
    bboxMinLng,
    bboxMaxLng,
    radiusCenterLat,
    radiusCenterLng,
    radiusMeters,
  } = opts;

  const typeExpr = buildTypeExpr('ne');
  const channelExpr = NETWORK_CHANNEL_EXPR('ne');
  const threatScoreExpr = buildThreatScoreExpr(simpleRuleScoringEnabled);
  const threatLevelExpr = buildThreatLevelExpr(threatScoreExpr);

  const distanceExpr = homeLocation
    ? buildDistanceExpr(homeLocation.lat, homeLocation.lon, 'ne', 'o')
    : 'NULL';
  const selectColumns = getBaseSelectColumns(channelExpr);
  const columnsWithDistance = withDistanceColumn(selectColumns, Boolean(homeLocation));
  const joins = getBaseJoins();

  const queryState = createNetworkQueryState(columnsWithDistance, joins);

  applyTextAndRangeFilters(
    queryState,
    {
      ssidPattern,
      bssidList,
      threatLevel,
      threatCategories,
      threatScoreMin,
      threatScoreMax,
      lastSeen,
      distanceFromHomeKm,
      distanceFromHomeMinKm,
      distanceFromHomeMaxKm,
      minSignal,
      maxSignal,
      minObsCount,
      maxObsCount,
      manufacturer,
      quickSearchPattern,
    },
    {
      threatLevelExpr,
      threatScoreExpr,
      distanceExpr,
    }
  );
  applySecurityAndRadioFilters(
    queryState,
    {
      radioTypes,
      encryptionTypes,
      authMethods,
      insecureFlags,
      securityFlags,
    },
    {
      typeExpr,
    }
  );
  applyLocationFilters(queryState, {
    locationMode,
    bboxMinLat,
    bboxMaxLat,
    bboxMinLng,
    bboxMaxLng,
    radiusCenterLat,
    radiusCenterLng,
    radiusMeters,
  });

  return {
    queryParts: queryState,
    channelExpr,
    threatLevelExpr,
  };
};

export { buildNetworkQueryParts };
