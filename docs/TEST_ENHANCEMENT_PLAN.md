# Test Enhancement Plan

## High-Priority Gaps (Critical Infrastructure & Security)

### 1. AuthService Unit Tests

- **Status**: Untested (Critical Gap).
- **Impact**: Authentication is the security backbone of the app.
- **Requirement**: Unit test `AuthService` by mocking `authQueries` and `authWrites`.
- **Target Coverage**: 90%+
- **Estimated Effort**: 1.5 hours.

### 2. Input Validation Schema Tests

- **Status**: 10% Coverage (High Risk).
- **Impact**: Improper validation can lead to crashes or security vulnerabilities.
- **Requirement**: Systematically test Joi/Zod schemas in `server/src/validation/schemas` with valid, invalid, and edge cases.
- **Estimated Effort**: 2 hours.

### 3. Admin User & Role Management

- **Status**: 23% Coverage.
- **Impact**: Unauthorized user creation or role escalation is a major threat.
- **Requirement**: Test `adminUsersService` and `adminSettingsService`.
- **Estimated Effort**: 1 hour.

## Medium-Priority Gaps (Core Business Features)

### 1. WiGLE Enrichment Logic

- **Status**: 0% Coverage.
- **Impact**: Inaccurate data enrichment impacts signals intelligence quality.
- **Requirement**: Test the transformation logic in `wigleEnrichmentService`.
- **Estimated Effort**: 1.5 hours.

### 2. Geocoding Daemon Reliability

- **Status**: 24% Coverage.
- **Impact**: Flaky geocoding delays spatial analysis.
- **Requirement**: Test `daemonRuntime` and `providerRuntime` with mocked providers.
- **Estimated Effort**: 2 hours.

## Test Infrastructure Improvements

### 1. Mock Standardization & Factories

- **Objective**: Replace hardcoded data fixtures (`grep -r "const.*=.*{.*:" tests/unit/ | wc -l` = 57) with a centralized factory system.
- **Implementation**: Create a `tests/fixtures/factories.ts` with builders for `User`, `NetworkRow`, `Observation`, etc.

### 2. Coverage Threshold Enforcement

- **Objective**: Prevent coverage regression.
- **Implementation**: Incrementally increase global coverage thresholds in `jest.config.js`. Start by setting them to current values (33%) and raise them as tests are added.

### 3. Fix Existing Failures

- **Objective**: Clean baseline before adding new tests.
- **Implementation**: Fix `client/src/utils/__tests__/tooltipDataNormalizer.test.ts` and `tests/unit/networkFastPathPredicates.test.ts`.

## Implementation Roadmap (Completed)

- [x] **Turn 1: Foundation & Security**: Fix existing failures, set up factories, and implement `AuthService` tests.
- [x] **Turn 2: Data Integrity**: Implement systematic validation schema tests and `WigleEnrichmentService` tests.
- [x] **Turn 3: Admin & Infrastructure**: Implement `AdminUsersService` tests and `GeocodingDaemon` tests. Update `jest.config.js` with thresholds.
- [x] **Turn 4: Subagent Expansion (Bonus)**: Expanded coverage for `ouiGroupingService`, ML services, and Core Business Services (`explorerService`, `dashboardService`, `mobileIngestService`) to >90%.
- [x] **Turn 5: Deep Service Expansion**: Expanded coverage for Networking Core (`homeLocation.ts`, `sql.ts`), WiGLE Import Infrastructure (`runRepository.ts`, `params.ts`), and Networking Filter Builders to >90%.
- [x] **Turn 6: Deep Infrastructure Expansion**: Expanded coverage for WiGLE High-Level Services (`wigleImportService.ts`, `wigleImportRunService.ts`) and Geocoding State (`jobState.ts`) to 100% Statements. Refined WebSocket terminal tests.
- [x] **Turn 7: WiGLE Utilities & Query Builders**: Expanded coverage for WiGLE Client/Ledger/AuditLogger and Filter Query Builder modules (`universalFilterQueryBuilder.ts`, `SqlFragmentLibrary.ts`) to 100% Statements. Refined `wigleClient.ts` retry logic tests.
      hresholds.
