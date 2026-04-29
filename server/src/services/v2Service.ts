/**
 * V2 API Service Layer
 * Thin orchestrator — delegates all data access to v2Repository.
 */

export type {
  ThreatLevel,
  NetworkListItem,
  NetworkListResult,
  NetworkDetailRow,
  TimelineRow,
  ThreatDataRow,
  NetworkDetail,
  DashboardMetrics,
  ThreatMapRow,
  ObservationMapRow,
  ThreatMapResult,
  SeverityCounts,
} from '../types/v2Types';

export {
  executeV2Query,
  listNetworks,
  getNetworkDetail,
  getDashboardMetrics,
  getThreatMapData,
  getThreatSeverityCounts,
  checkHomeExists,
  fetchMissingSiblingRows,
} from '../repositories/v2Repository';

module.exports = {
  executeV2Query: require('../repositories/v2Repository').executeV2Query,
  listNetworks: require('../repositories/v2Repository').listNetworks,
  getNetworkDetail: require('../repositories/v2Repository').getNetworkDetail,
  getDashboardMetrics: require('../repositories/v2Repository').getDashboardMetrics,
  getThreatMapData: require('../repositories/v2Repository').getThreatMapData,
  getThreatSeverityCounts: require('../repositories/v2Repository').getThreatSeverityCounts,
  checkHomeExists: require('../repositories/v2Repository').checkHomeExists,
  fetchMissingSiblingRows: require('../repositories/v2Repository').fetchMissingSiblingRows,
};
