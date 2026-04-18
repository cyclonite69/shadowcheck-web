# Test Suite Audit Report (UPDATED April 18, 2026)

## Current State (Post-Enhancement Round 2)

- **Total Test Files**: 98+
- **Test Types**:
  - **Unit Tests**: Majority (approx. 90+ files)
  - **Integration Tests**: 9 files in `tests/integration/`
  - **Certification Tests**: 1 file
  - **API Tests**: 2 files
- **Coverage (Server Code)**:
  - **Statements**: 52.59%
  - **Branches**: 43.61%
  - **Functions**: 47.52%
  - **Lines**: 54.09%
- **Pass/Fail Status**:
  - **Passed**: 2108 (Significant expansion in geospatial, networking core, and import logic)
  - **Failed**: 0
  - **Skipped**: 37 (Integration tests skipped when DB is not available)

## Gap Analysis & Categorization

### Tested (Well) -> [EXPANDED]

- **filterQueryBuilder**: 92%+ coverage.
- **networkListService**: 100% coverage.
- **v2Service / v2Queries**: 90%+ coverage.
- **agencyService / courthouseService**: 100% coverage.
- **Networking Core (homeLocation / sql)**: 100% coverage.
- **Networking Filter Builders**: >90% branch coverage across all modules.
- **AuthService / AdminUsersService**: 100% line coverage.

### Tested (Partially) -> [IMPROVED]

- **wigleImportRunService**: 75% coverage.
- **mobileIngestService**: Reached >90% line coverage.
- **dashboardService**: 100% line coverage.
- **explorerService**: 100% line coverage.
- **WiGLE Import Infrastructure (runRepository / params)**: >95% statement coverage.

### Untested (Critical Gaps) -> [ADDRESSED]

- ~~**authService / authQueries / authWrites**~~: Reached 100% line coverage.
- ~~**adminSettingsService / adminMaintenanceService / adminUsersService**~~: Reached 100% line coverage.
- ~~**geocoding (services/geocoding/\*)**~~: Addressed via daemon/provider tests.
- ~~**ml (services/ml/\*)**~~: Reached >90% branch coverage.
- ~~**wigleEnrichmentService**~~: Reached >90% coverage.
- ~~**Validation Middleware / Schemas**~~: Systematically tested all schemas.
- ~~**ouiGroupingService**~~: Increased to >90% branch coverage.

## Root Causes of Untested Code (Mitigated)

1.  **Tight Coupling to Database**: Mitigated using structured mocking of query/adminQuery helpers.
2.  **Mocking Inconsistency**: Standardized using module-level mocks and explicit instance property overrides for private state.
3.  **Legacy CommonJS/ESM Mix**: Most critical tests converted to ESM imports for accurate coverage tracking.

## Specific Modules Needing Tests (Next Priorities)

1.  **Background Jobs (Runners)**: While config is tested, actual job execution timing and retry loops could use more stress testing.
2.  **Websocket (SSM Terminal)**: Coverage is at 87%, could be pushed to 100%.
3.  **Secrets Manager Retries**: Error paths for AWS Secrets Manager retries are complex and partially tested.
