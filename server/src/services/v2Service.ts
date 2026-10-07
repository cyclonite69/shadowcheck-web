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
  withFilteredNetworkRequest,
  listNetworks,
  getNetworkDetail,
  getDashboardMetrics,
  getThreatMapData,
  getThreatSeverityCounts,
  checkHomeExists,
  fetchMissingSiblingRows,
  getNetworksByBssids,
  checkNetworksExist,
} from '../repositories/v2Repository';
