const container = require('../../../server/src/config/container');

describe('DI Container Structural Lock', () => {
  it('should successfully load the container and expose the central registry object', () => {
    expect(container).toBeDefined();
    expect(typeof container).toBe('object');
  });

  it('should register exactly all 57 expected service keys', () => {
    const expectedKeys = [
      'adminDbService',
      'adminSiblingService',
      'adminUsersService',
      'adminMaintenanceService',
      'adminDbStatsService',
      'adminImportHistoryService',
      'adminOrphanNetworksService',
      'adminNetworkMediaService',
      'adminNetworkTagsService',
      'networkTagsAdminService',
      'settingsAdminService',
      'importExportAdminService',
      'dataQualityAdminService',
      'siblingDetectionAdminService',
      'agencyService',
      'courthouseService',
      'deflockService',
      'alprService',
      'shotspotterSensorsService',
      'aiInsightsService',
      'bedrockService',
      'analyticsService',
      'authService',
      'awsService',
      'backupService',
      'backgroundJobsService',
      'cacheService',
      'dashboardService',
      'dataQualityFilters',
      'explorerService',
      'exportService',
      'externalServiceHandler',
      'filterQueryBuilder',
      'filteredAnalyticsService',
      'geocodingCacheService',
      'homeLocationService',
      'keplerService',
      'miscService',
      'mobileIngestService',
      'mlScoringService',
      'mlTrainingLock',
      'networkListService',
      'networkService',
      'networkTagService',
      'observationService',
      'ouiGroupingService',
      'pgadminService',
      'secretsManager',
      'threatScoringService',
      'threatReportService',
      'v2Service',
      'wigleEnrichmentService',
      'wigleImportService',
      'wigleImportRunService',
      'wigleBluetoothImportService',
      'wigleService',
      'importService',
      'databaseService',
    ];

    expect(Object.keys(container).length).toBe(expectedKeys.length);

    expectedKeys.forEach((key) => {
      expect(container).toHaveProperty(key);
      expect(container[key]).toBeDefined();
    });
  });

  it('should assert interface shapes for key critical services to ensure correct instantiation', () => {
    // 1. authService shape
    expect(typeof container.authService.login).toBe('function');
    expect(typeof container.authService.validateSession).toBe('function');
    expect(typeof container.authService.logout).toBe('function');

    // 2. adminDbService shape
    expect(typeof container.adminDbService.adminQuery).toBe('function');
    expect(typeof container.adminDbService.forensicQuery).toBe('function');
    expect(typeof container.adminDbService.getAdminPool).toBe('function');

    // 3. databaseService shape
    expect(typeof container.databaseService.query).toBe('function');
    expect(typeof container.databaseService.longRunningQuery).toBe('function');
    expect(typeof container.databaseService.closePool).toBe('function');

    // 4. geocodingCacheService shape
    expect(typeof container.geocodingCacheService.runGeocodeCacheUpdate).toBe('function');
    expect(typeof container.geocodingCacheService.getGeocodingCacheStats).toBe('function');

    // 5. cacheService shape
    expect(typeof container.cacheService.get).toBe('function');
    expect(typeof container.cacheService.set).toBe('function');
    expect(typeof container.cacheService.connect).toBe('function');

    // 6. secretsManager shape
    expect(typeof container.secretsManager.getSecret).toBe('function');

    // 7. mlScoringService shape
    expect(typeof container.mlScoringService.getMLModelStatus).toBe('function');
    expect(typeof container.mlScoringService.getMLTrainingData).toBe('function');

    // 8. wigleService shape
    expect(typeof container.wigleService.getWigleDatabase).toBe('function');
    expect(typeof container.wigleService.getWigleObservations).toBe('function');

    // 9. observationService shape
    expect(typeof container.observationService.getObservationsByBSSID).toBe('function');
    expect(typeof container.observationService.getOurObservationCount).toBe('function');

    // 10. backgroundJobsService shape
    expect(typeof container.backgroundJobsService.initialize).toBe('function');
    expect(typeof container.backgroundJobsService.shutdown).toBe('function');
  });
});
