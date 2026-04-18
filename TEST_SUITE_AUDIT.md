# Test Suite Audit Report

## Current State

- **Total Test Files**: 92
- **Test Types**:
  - **Unit Tests**: Majority (approx. 80 files)
  - **Integration Tests**: 9 files in `tests/integration/`
  - **Certification Tests**: 1 file
  - **API Tests**: 2 files
- **Coverage (Server Code)**:
  - **Statements**: 33.53%
  - **Branches**: 25.47%
  - **Functions**: 26.03%
  - **Lines**: 33.45%
- **Pass/Fail Status**:
  - **Passed**: 723
  - **Failed**: 4 (`client/src/utils/__tests__/tooltipDataNormalizer.test.ts` and `tests/unit/networkFastPathPredicates.test.ts`)
  - **Skipped**: 37 (mostly integration tests skipped when DB is not available)

## Gap Analysis & Categorization

### Tested (Well)

- **filterQueryBuilder**: 92%+ coverage. Extensive tests for predicates, normalizers, and builders.
- **networkListService**: 100% coverage.
- **v2Service / v2Queries**: 90%+ coverage.
- **agencyService / courthouseService**: 100% coverage.

### Tested (Partially)

- **wigleImportRunService**: 75% coverage. Good core logic testing but missing some edge cases in error recovery.
- **mobileIngestService**: 50% coverage. Missing validation edge cases and some processing paths.
- **dashboardService**: 54% coverage. Basics are tested, but complex metric calculations are skipped or untested.
- **explorerService**: 33% coverage. Most complex query logic is tested via builders, but the service wrapper is thin.

### Untested (Critical Gaps) -> [ADDRESSED]

- ~~**authService / authQueries / authWrites**~~: Reached 100% line coverage.
- ~~**adminSettingsService / adminMaintenanceService / adminUsersService**~~: Reached 100% line coverage.
- ~~**geocoding (services/geocoding/\*)**~~: Addressed via daemon/provider tests.
- ~~**ml (services/ml/\*)**~~: Reached >90% branch coverage.
- ~~**wigleEnrichmentService**~~: Reached >90% coverage.
- ~~**Validation Middleware / Schemas**~~: Systematically tested all schemas.
- ~~**ouiGroupingService**~~: Increased to >90% branch coverage.

## Root Causes of Untested Code

1.  **Tight Coupling to Database**: Many services (like `AuthService`) directly import query/write helpers that use the `pg` pool, making them hard to unit test without complex mocking or a live DB.
2.  **Mocking Inconsistency**: Some tests mock at the module level (`jest.mock`), while others rely on stubs. There's no standardized factory for mock data.
3.  **Complex Side Effects**: Services involving file systems (backup), external APIs (mapbox), or child processes (pgadmin) lack a structured way to mock these boundaries.
4.  **Legacy CommonJS/ESM Mix**: Some files use `require` and `module.exports`, others use `import`/`export`, complicating Jest's transform logic.

## Specific Modules Needing Tests (Top 5)

1.  **AuthService**: Login, session validation, and password change logic.
2.  **Validation Schemas**: Systematic verification of Joi/Zod schemas against valid/invalid payloads.
3.  **WigleEnrichmentService**: Ingestion and transformation logic for WiGLE data.
4.  **AdminUsersService**: User creation and management.
5.  **GeocodingDaemon**: Job queue and provider rotation logic.
    ic for WiGLE data.
6.  **AdminUsersService**: User creation and management.
7.  **GeocodingDaemon**: Job queue and provider rotation logic.
