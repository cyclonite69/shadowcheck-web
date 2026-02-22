/**
 * DI Container — central service registry
 *
 * All application services are registered here as a flat object.
 * Route handlers import from this file, not directly from services/.
 * To swap an implementation (e.g. Bedrock-aware version), update the
 * require() on a single line here — no route files need to change.
 */

// ── Services ───────────────────────────────────────────────────────────────
const adminDbService = require('../services/adminDbService');
const agencyService = require('../services/agencyService');
const analyticsService = require('../services/analyticsService');
const authService = require('../services/authService');
const awsService = require('../services/awsService');
const backupService = require('../services/backupService');
const cacheService = require('../services/cacheService');
const dashboardService = require('../services/dashboardService');
const dataQualityFilters = require('../services/dataQualityFilters');
const explorerService = require('../services/explorerService');
const exportService = require('../services/exportService');
const externalServiceHandler = require('../services/externalServiceHandler');
const filterQueryBuilder = require('../services/filterQueryBuilder');
const geocodingCacheService = require('../services/geocodingCacheService');
const homeLocationService = require('../services/homeLocationService');
const keplerService = require('../services/keplerService');
const miscService = require('../services/miscService');
const mlScoringService = require('../services/ml/scoringService');
const mlTrainingLock = require('../services/mlTrainingLock');
const networkService = require('../services/networkService');
const observationService = require('../services/observationService');
const ouiGroupingService = require('../services/ouiGroupingService');
const pgadminService = require('../services/pgadminService');
const secretsManager = require('../services/secretsManager').default;
const threatScoringService = require('../services/threatScoringService');
const v2Service = require('../services/v2Service');
const wigleImportService = require('../services/wigleImportService');
const wigleService = require('../services/wigleService');

const container = {
  adminDbService,
  agencyService,
  analyticsService,
  authService,
  awsService,
  backupService,
  cacheService,
  dashboardService,
  dataQualityFilters,
  explorerService,
  exportService,
  externalServiceHandler,
  filterQueryBuilder,
  geocodingCacheService,
  homeLocationService,
  keplerService,
  miscService,
  mlScoringService,
  mlTrainingLock,
  networkService,
  observationService,
  ouiGroupingService,
  pgadminService,
  secretsManager,
  threatScoringService,
  v2Service,
  wigleImportService,
  wigleService,
};

module.exports = container;
export {};
