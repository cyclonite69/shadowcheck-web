import {
  analyzeSourceText,
  resolveRelativeImport,
} from '../../scripts/audit/architecture/inventory';
import { analyzeTestGaps, parseCoverageArtifactJson } from '../../scripts/audit/testGapAnalysis';
import { renderTestGapReport } from '../../scripts/audit/testGapReporting';
import {
  classifyRole,
  isRepositoryOrchestrationImport,
} from '../../scripts/audit/architecture/modularityAnalysis';
import { emitAuditReport, parseAuditCli } from '../../scripts/audit/architecture/cli';
import { buildRefactorRoadmap } from '../../scripts/audit/architecture/roadmap';
import { renderCruftReport } from '../../scripts/audit/architecture/reporting';
import type {
  CruftAuditResult,
  ModularityAuditResult,
  RepositoryInventory,
  SourceRecord,
} from '../../scripts/audit/architecture/types';

const emptyInventory = (records: SourceRecord[] = []): RepositoryInventory => ({
  repoRoot: '/repo',
  head: 'abc12345',
  generatedDate: '2026-06-20',
  allFiles: records.map((record) => record.path),
  sourceRecords: records,
  sourceByPath: new Map(records.map((record) => [record.path, record])),
  inboundReferences: new Map(records.map((record) => [record.path, []])),
  packageManifest: {},
  documentedEnvKeys: [],
  usedEnvKeys: [],
});

const emptyCruft = (): CruftAuditResult => ({
  findings: [],
  unreferencedFiles: [],
  unusedExports: [],
  orphanTests: [],
  dependencyCandidates: [],
  envCandidates: [],
  temporaryFiles: [],
});

const emptyModularity = (): ModularityAuditResult => ({
  findings: [],
  oversizedModules: [],
  roleViolations: [],
  couplingCandidates: [],
  policyFindings: [],
  largestModules: [],
});

describe('architecture audit tooling', () => {
  it('identifies static test-gap candidates while labeling heuristic sections', () => {
    const source = analyzeSourceText(
      'server/src/api/routes/v1/example.ts',
      'export const route = () => true;\n'
    );
    const untested = analyzeSourceText(
      'server/src/services/uncovered.ts',
      'export const run = () => false;\n'
    );
    const test = analyzeSourceText(
      'tests/unit/example.test.ts',
      `
        import { route } from '../../server/src/api/routes/v1/example';
        test.skip('disabled behavior', () => {});
        test('does not make a recognizable assertion', () => route());
      `
    );
    test.imports[0].resolvedPath = source.path;
    const inventory = emptyInventory([source, untested, test]);
    const result = analyzeTestGaps(inventory, null, null);
    const report = renderTestGapReport(inventory, result);

    expect(result.untestedModules.map((item) => item.path)).toEqual([untested.path]);
    expect(result.skippedTests).toHaveLength(1);
    expect(result.qualityCandidates).toHaveLength(1);
    expect(result.integrationCandidates).toHaveLength(1);
    expect(result.coverageSummaryStatus).toBe('missing');
    expect(report).toContain('Summary artifact: **missing**');
    expect(report).toContain('not proof of missing behavior coverage');
  });

  it('distinguishes missing, unusable, and usable coverage summaries', () => {
    const source = analyzeSourceText(
      'server/src/services/example.ts',
      'export const run = () => true;\n'
    );
    const inventory = emptyInventory([source]);
    const totalOnly = {
      total: {
        branches: { covered: 1, total: 1, pct: 100 },
        functions: { covered: 1, total: 1, pct: 100 },
      },
    };

    expect(analyzeTestGaps(inventory).coverageSummaryStatus).toBe('missing');
    expect(analyzeTestGaps(inventory, {}).coverageSummaryStatus).toBe('present-unusable');
    expect(analyzeTestGaps(inventory, totalOnly).coverageSummaryStatus).toBe('present-unusable');
    expect(
      analyzeTestGaps(inventory, {
        '/repo/server/src/services/unrelated.ts': {
          branches: { covered: 1, total: 2, pct: 50 },
        },
      }).coverageSummaryStatus
    ).toBe('present-unusable');
    const branchOnlyResult = analyzeTestGaps(inventory, {
      '/repo/server/src/services/example.ts': {
        branches: { covered: 1, total: 2, pct: 50 },
      },
    });
    expect(branchOnlyResult.coverageSummaryStatus).toBe('usable');
    expect(branchOnlyResult.coverageBranchMatchedFiles).toBe(1);
    expect(branchOnlyResult.coverageFunctionMatchedFiles).toBe(0);
    expect(renderTestGapReport(inventory, branchOnlyResult)).toContain(
      'No usable per-file function metrics matched the inventory; this section is unavailable.'
    );
    expect(renderTestGapReport(inventory, branchOnlyResult)).toContain(
      'no per-file function totals matched the inventory'
    );
  });

  it('tracks branch and function coverage availability independently', () => {
    const records = ['branchOnly', 'functionOnly', 'both', 'noMetrics'].map((name) =>
      analyzeSourceText(`server/src/services/${name}.ts`, 'export const run = () => true;\n')
    );
    const inventory = emptyInventory(records);
    const branchMetric = { covered: 1, total: 2, pct: 50 };
    const functionMetric = { covered: 0, total: 1, pct: 0 };
    const summary = {
      '/repo/server/src/services/branchOnly.ts': { branches: branchMetric },
      '/repo/server/src/services/functionOnly.ts': { functions: functionMetric },
      '/repo/server/src/services/both.ts': {
        branches: branchMetric,
        functions: functionMetric,
      },
      '/repo/server/src/services/noMetrics.ts': {
        lines: { covered: 1, total: 1, pct: 100 },
      },
    };

    const result = analyzeTestGaps(inventory, summary);
    const report = renderTestGapReport(inventory, result);

    expect(result.coverageSummaryStatus).toBe('usable');
    expect(result.coverageSummaryMatchedFiles).toBe(3);
    expect(result.coverageBranchMatchedFiles).toBe(2);
    expect(result.coverageFunctionMatchedFiles).toBe(2);
    expect(result.coverageEligibleFiles).toBe(4);
    expect(report).toContain('Branch metrics matched 2 of 4 inventoried application modules');
    expect(report).toContain('Function metrics matched 2 of 4 inventoried application modules');
    expect(report).toContain('missing records are not treated as zero');

    const noMetrics = analyzeTestGaps(inventory, {
      total: {
        branches: { covered: 0, total: 0, pct: 100 },
        functions: { covered: 0, total: 0, pct: 100 },
      },
    });
    const noMetricsReport = renderTestGapReport(inventory, noMetrics);
    expect(noMetrics.coverageSummaryStatus).toBe('present-unusable');
    expect(noMetrics.coverageBranchMatchedFiles).toBe(0);
    expect(noMetrics.coverageFunctionMatchedFiles).toBe(0);
    expect(noMetricsReport).toContain('No usable per-file branch metrics matched the inventory');
    expect(noMetricsReport).toContain('No usable per-file function metrics matched the inventory');
  });

  it('reports the latest snapshot time and missing function-detail artifact', () => {
    const source = analyzeSourceText(
      'server/src/services/example.ts',
      'export const run = () => true;\n'
    );
    const inventory = emptyInventory([source]);
    const summary = {
      '/repo/server/src/services/example.ts': {
        branches: { covered: 1, total: 2, pct: 50 },
        functions: { covered: 0, total: 1, pct: 0 },
      },
    };
    const result = analyzeTestGaps(inventory, summary, null, {
      summaryModifiedAt: '2026-10-13T10:06:14.268Z',
      finalModifiedAt: null,
    });
    const report = renderTestGapReport(inventory, result);

    expect(result.coverageSummaryMatchedFiles).toBe(1);
    expect(result.coverageFunctionMatchedFiles).toBe(1);
    expect(result.coverageFinalPresent).toBe(false);
    expect(result.coverageFunctionDetailsStatus).toBe('missing');
    expect(report).toContain('latest available snapshot');
    expect(report).toContain('2026-10-13T10:06:14.268Z');
    expect(report).toContain('Function details artifact: **missing**');
    expect(report).toContain('summary-level function totals remain available');
  });

  it('uses function names only when detailed counts reconcile with summary metrics', () => {
    const source = analyzeSourceText(
      'server/src/services/example.ts',
      'export const run = () => true;\n'
    );
    const inventory = emptyInventory([source]);
    const summary = {
      '/repo/server/src/services/example.ts': {
        functions: { covered: 1, total: 2, pct: 50 },
      },
    };
    const coverageFinal = {
      '/repo/server/src/services/example.ts': {
        path: '/repo/server/src/services/example.ts',
        f: { '0': 0, '1': 1 },
        fnMap: {
          '0': { name: 'uncovered', line: 1 },
          '1': { name: 'covered', line: 2 },
        },
      },
    };
    const result = analyzeTestGaps(inventory, summary, coverageFinal, {
      summaryModifiedAt: '2026-11-05T10:00:00.000Z',
      finalModifiedAt: '2026-11-05T10:00:00.000Z',
    });

    expect(result.coverageFunctionDetailsStatus).toBe('reconciled');
    expect(result.coverageFunctionDetailsMatchedFiles).toBe(1);
    expect(result.uncoveredFunctions[0].evidence).toContain('uncovered (line 1)');
  });

  it('discloses materially different artifact timestamps without assuming run identity', () => {
    const source = analyzeSourceText(
      'server/src/services/example.ts',
      'export const run = () => true;\n'
    );
    const inventory = emptyInventory([source]);
    const summary = {
      '/repo/server/src/services/example.ts': {
        functions: { covered: 1, total: 2, pct: 50 },
      },
    };
    const coverageFinal = {
      '/repo/server/src/services/example.ts': {
        path: '/repo/server/src/services/example.ts',
        f: { '0': 0, '1': 1 },
        fnMap: { '0': { name: 'uncovered' }, '1': { name: 'covered' } },
      },
    };
    const result = analyzeTestGaps(inventory, summary, coverageFinal, {
      summaryModifiedAt: '2026-11-05T11:00:00.000Z',
      finalModifiedAt: '2026-11-05T10:00:00.000Z',
    });
    const report = renderTestGapReport(inventory, result);

    expect(result.coverageArtifactTimeDeltaMs).toBe(60 * 60 * 1000);
    expect(report).toContain('Modification times differ by 3600000 ms');
    expect(report).toContain(
      'timestamps alone do not prove whether artifacts came from the same run'
    );
  });

  it('suppresses function names when detailed counts disagree or records are missing', () => {
    const source = analyzeSourceText(
      'server/src/services/example.ts',
      'export const run = () => true;\n'
    );
    const inventory = emptyInventory([source]);
    const summary = {
      '/repo/server/src/services/example.ts': {
        functions: { covered: 0, total: 2, pct: 0 },
      },
    };
    const mismatchedFinal = {
      '/repo/server/src/services/example.ts': {
        path: '/repo/server/src/services/example.ts',
        f: { '0': 0, '1': 1 },
        fnMap: { '0': { name: 'uncovered' }, '1': { name: 'covered' } },
      },
    };
    const mismatched = analyzeTestGaps(inventory, summary, mismatchedFinal);
    expect(mismatched.coverageFunctionDetailsStatus).toBe('inconsistent');
    expect(mismatched.coverageFunctionDetailsMismatchedFiles).toBe(1);
    expect(mismatched.uncoveredFunctions[0].evidence).toContain('0 of 2 functions');
    expect(mismatched.uncoveredFunctions[0].evidence).not.toContain('uncovered');

    const missingRecord = analyzeTestGaps(inventory, summary, {});
    expect(missingRecord.coverageFunctionDetailsStatus).toBe('incomplete');
    expect(missingRecord.coverageFunctionDetailsIncompleteFiles).toBe(1);
    expect(missingRecord.uncoveredFunctions[0].evidence).toContain('0 of 2 functions');
    expect(missingRecord.uncoveredFunctions[0].evidence).not.toContain('uncovered');
  });

  it('fails clearly for malformed coverage artifact JSON and non-object roots', () => {
    expect(() => parseCoverageArtifactJson('coverage/coverage-summary.json', '{')).toThrow(
      'Unable to parse coverage artifact coverage/coverage-summary.json'
    );
    expect(() => parseCoverageArtifactJson('coverage/coverage-summary.json', '[]')).toThrow(
      'Coverage artifact must contain a JSON object'
    );
  });

  it('detects relative imports without accepting unrelated filename prefixes', () => {
    const test = analyzeSourceText(
      'tests/unit/imports.test.ts',
      "import missing from './helper';\ntest('loads helper', () => expect(missing).toBeDefined());\n"
    );
    const inventory = emptyInventory([test]);
    inventory.allFiles.push('tests/unit/helper.extra.ts');

    expect(analyzeTestGaps(inventory).brokenImports).toHaveLength(1);
  });

  it('excludes pure re-export barrels but retains logic-bearing index modules', () => {
    const barrel = analyzeSourceText(
      'server/src/services/barrel/index.ts',
      "export { run } from '../run';\n"
    );
    const logicIndex = analyzeSourceText(
      'server/src/services/logic/index.ts',
      'export const initialize = () => true;\n'
    );
    const inventory = emptyInventory([barrel, logicIndex]);

    expect(analyzeTestGaps(inventory).untestedModules.map((finding) => finding.path)).toEqual([
      logicIndex.path,
    ]);
  });

  it('recognizes skipIf and parses JSX test files with JSX syntax', () => {
    const extensions = ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts'];
    const records = extensions.map((extension) => {
      const jsx = extension === 'tsx' || extension === 'jsx' ? 'const element = <div />;' : '';
      return analyzeSourceText(
        `tests/unit/widget.test.${extension}`,
        `${jsx}\ntest.skipIf(true)('disabled case', () => {});\n`
      );
    });
    const inventory = emptyInventory(records);
    const result = analyzeTestGaps(inventory);

    expect(result.skippedTests).toHaveLength(extensions.length);
  });

  it('detects supported skipped and todo test markers', () => {
    const test = analyzeSourceText(
      'tests/unit/disabled.test.ts',
      `
        test.skip('skipped', () => {});
        it.skip('skipped', () => {});
        xit('skipped', () => {});
        xtest('skipped', () => {});
        xdescribe('skipped', () => {});
        test.todo('todo');
        describe.skip('skipped suite', () => {});
        it.skipIf(true)('conditional skip', () => {});
      `
    );

    expect(analyzeTestGaps(emptyInventory([test])).skippedTests).toHaveLength(8);
  });

  it('flags test declarations without their own recognizable assertions', () => {
    const test = analyzeSourceText(
      'tests/unit/assertions.test.ts',
      `
        expect(true).toBe(true);
        test('bare expect is not a matcher', () => expect(true));
        test('custom helper requires review', () => verifyBehavior());
      `
    );
    const inventory = emptyInventory([test]);
    const [finding] = analyzeTestGaps(inventory).qualityCandidates;

    expect(finding.evidence).toContain('2 of 2 test declaration(s)');
  });

  it('reports branch and function gaps and unresolved test imports from coverage evidence', () => {
    const source = analyzeSourceText(
      'server/src/services/example.ts',
      'export const run = () => true;\n'
    );
    const test = analyzeSourceText(
      'tests/unit/example.test.ts',
      `
        import { run } from '../../server/src/services/example';
        import missing from './missingModule';
        test('runs', () => expect(run()).toBe(true));
      `
    );
    test.imports[0].resolvedPath = source.path;
    const inventory = emptyInventory([source, test]);
    const coverageSummary = {
      '/repo/server/src/services/example.ts': {
        branches: { covered: 1, total: 3, pct: 33.33 },
        functions: { covered: 0, total: 1, pct: 0 },
      },
    };
    const coverageFinal = {
      '/repo/server/src/services/example.ts': {
        path: '/repo/server/src/services/example.ts',
        f: { '0': 0 },
        fnMap: { '0': { name: 'run', line: 1 } },
      },
    };

    const result = analyzeTestGaps(inventory, coverageSummary, coverageFinal);

    expect(result.uncoveredBranches[0].evidence).toContain('1 of 3 branches');
    expect(result.uncoveredFunctions[0].evidence).toContain('run (line 1)');
    expect(result.brokenImports[0].evidence).toContain('./missingModule');
  });

  it('does not report unresolved imports when a relative asset exists', () => {
    const test = analyzeSourceText(
      'tests/unit/asset.test.ts',
      "import fixture from './fixture';\ntest('loads fixture', () => expect(fixture).toBeDefined());\n"
    );
    const inventory = emptyInventory([test]);
    inventory.allFiles.push('tests/unit/fixture.json');

    expect(analyzeTestGaps(inventory).brokenImports).toEqual([]);
  });

  it('collects static, dynamic, type-only, and Jest module references', () => {
    const record = analyzeSourceText(
      'client/src/App.tsx',
      `
        import { alpha } from './alpha';
        const Page = lazy(() => import('./Page'));
        type Config = import('./types').Config;
        jest.mock('./mocked');
        const commonJs = require('./commonJs');
        export const value = alpha;
      `
    );

    expect(record.imports.map((item) => item.specifier)).toEqual(
      expect.arrayContaining(['./alpha', './Page', './types', './mocked', './commonJs'])
    );
    expect(record.exports).toContain('value');
  });

  it('resolves extensionless and index imports against the inventory', () => {
    const paths = new Set([
      'client/src/alpha.ts',
      'client/src/beta/index.tsx',
      'server/src/config/database.ts',
      'server/src/config/runtime.mts',
      'server/src/config/legacy.cts',
    ]);
    expect(resolveRelativeImport('client/src/App.tsx', './alpha', paths)).toBe(
      'client/src/alpha.ts'
    );
    expect(resolveRelativeImport('client/src/App.tsx', './beta', paths)).toBe(
      'client/src/beta/index.tsx'
    );
    expect(
      resolveRelativeImport('tests/unit/database.test.ts', 'server/src/config/database', paths)
    ).toBe('server/src/config/database.ts');
    expect(
      resolveRelativeImport('tests/unit/runtime.test.ts', '../../server/src/config/runtime', paths)
    ).toBe('server/src/config/runtime.mts');
    expect(
      resolveRelativeImport('tests/unit/legacy.test.ts', '../../server/src/config/legacy', paths)
    ).toBe('server/src/config/legacy.cts');
  });

  it('counts SQL only from code literals, not comments', () => {
    const record = analyzeSourceText(
      'server/src/api/routes/v1/example.ts',
      `
        // SELECT and DELETE are documentation only.
        const sql = 'SELECT * FROM app.example';
        query(sql);
      `
    );
    expect(record.metrics.sqlStatementCount).toBe(1);
    expect(record.metrics.lineCount).toBe(5);
  });

  it('matches the existing policy export-count semantics for CommonJS modules', () => {
    const record = analyzeSourceText(
      'server/src/example.ts',
      'export {};\nconst alpha = 1;\nconst beta = 2;\nmodule.exports = { alpha, beta };\n'
    );
    expect(record.exports).toEqual(['alpha', 'beta']);
    expect(record.metrics.exportCount).toBe(3);
  });

  it('classifies common architectural roles deterministically', () => {
    expect(classifyRole('server/src/api/routes/v1/health.ts')).toBe('route');
    expect(classifyRole('server/src/repositories/networkRepository.ts')).toBe('repository');
    expect(classifyRole('client/src/components/geospatial/hooks/useMap.ts')).toBe('hook');
    expect(classifyRole('client/src/config/apiTestEndpoints.ts')).toBe('registry');
  });

  it('does not treat repository support modules as orchestration dependencies', () => {
    expect(
      isRepositoryOrchestrationImport('server/src/services/filterQueryBuilder/sqlExpressions.ts')
    ).toBe(false);
    expect(
      isRepositoryOrchestrationImport(
        'server/src/services/wigleImport/repositories/runReadRepository.ts'
      )
    ).toBe(false);
    expect(
      isRepositoryOrchestrationImport('server/src/services/networkOrchestrationService.ts')
    ).toBe(true);
  });

  it('validates safe CLI arguments', () => {
    expect(parseAuditCli(['--date', '2026-06-20', '--stdout', '--top', '25'])).toEqual({
      date: '2026-06-20',
      stdout: true,
      output: null,
      top: 25,
    });
    expect(() => parseAuditCli(['--date', '06/20/2026'])).toThrow('Invalid --date');
    expect(() => parseAuditCli(['--unknown'])).toThrow('Unknown audit option');
  });

  it('refuses report output outside docs/audits', () => {
    expect(() =>
      emitAuditReport('/repo', 'audit.md', '# Audit', {
        date: '2026-06-20',
        stdout: false,
        output: 'docs/architecture-audit.md',
        top: 25,
      })
    ).toThrow('Audit reports may only be written under docs/audits/');
  });

  it('keeps role locks ahead of extraction and deletion roadmap stages', () => {
    const record = analyzeSourceText(
      'client/src/hooks/useExample.ts',
      'export const useExample = () => Array.from({ length: 2 }, (_, index) => index);'
    );
    const inventory = emptyInventory([record]);
    const finding = {
      id: 'threshold:example',
      category: 'structural-threshold',
      severity: 'medium' as const,
      confidence: 'high' as const,
      path: record.path,
      evidence: 'Example exceeds a role threshold.',
      recommendation: 'Extract pure logic.',
      requiredTests: ['npx jest tests/unit/useExample.test.ts --no-coverage --runInBand'],
    };
    const modularity = emptyModularity();
    modularity.findings = [finding];
    const cruft = emptyCruft();
    cruft.unreferencedFiles = [{ ...finding, category: 'unreferenced-file' }];

    const roadmap = buildRefactorRoadmap(inventory, modularity, cruft);
    expect(roadmap.map((item) => item.stage)).toEqual([1, 2, 5]);
    expect(roadmap[0].priority).toBe('P1');
  });

  it('renders an explicit no-delete safety contract', () => {
    const report = renderCruftReport(emptyInventory(), emptyCruft());
    expect(report).toContain('findings are candidates, not deletion or refactor authorization');
    expect(report).toContain('No candidate in this report is approved for deletion');
  });
});
