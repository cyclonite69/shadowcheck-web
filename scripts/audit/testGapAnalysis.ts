import path from 'node:path';
import ts from 'typescript';
import { resolveRelativeImport } from './architecture/inventory';
import type { AuditFinding, RepositoryInventory, SourceRecord } from './architecture/types';

type CoverageMetric = {
  total: number;
  covered: number;
  pct: number;
};

type CoverageSummaryFile = {
  branches?: unknown;
  functions?: unknown;
};

type CoverageSummary = Record<string, unknown>;

type CoverageFunction = {
  name?: string;
  line?: number;
};

type CoverageFinalFile = {
  path?: string;
  f?: unknown;
  fnMap?: unknown;
};

type CoverageFinal = Record<string, CoverageFinalFile>;

type CoverageFunctionDetailsStatus =
  'missing' | 'not-applicable' | 'incomplete' | 'inconsistent' | 'reconciled';

export type CoverageArtifactMetadata = {
  summaryModifiedAt: string | null;
  finalModifiedAt: string | null;
};

export const parseCoverageArtifactJson = (
  filePath: string,
  contents: string
): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const wrappedError = new Error(
      `Unable to parse coverage artifact ${filePath}: ${detail}`
    ) as Error & { cause?: unknown };
    wrappedError.cause = error;
    throw wrappedError;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Coverage artifact must contain a JSON object: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
};

export type TestGapAuditResult = {
  untestedModules: AuditFinding[];
  uncoveredBranches: AuditFinding[];
  uncoveredFunctions: AuditFinding[];
  skippedTests: AuditFinding[];
  brokenImports: AuditFinding[];
  integrationCandidates: AuditFinding[];
  qualityCandidates: AuditFinding[];
  coverageSummaryStatus: 'missing' | 'present-unusable' | 'usable';
  coverageSummaryModifiedAt: string | null;
  coverageSummaryMatchedFiles: number;
  coverageBranchMatchedFiles: number;
  coverageFunctionMatchedFiles: number;
  coverageEligibleFiles: number;
  coverageFinalPresent: boolean;
  coverageFinalModifiedAt: string | null;
  coverageArtifactTimeDeltaMs: number | null;
  coverageFunctionDetailsStatus: CoverageFunctionDetailsStatus;
  coverageFunctionDetailsMatchedFiles: number;
  coverageFunctionDetailsIncompleteFiles: number;
  coverageFunctionDetailsMismatchedFiles: number;
};

const isTestFile = (filePath: string): boolean => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filePath);

const getScriptKind = (filePath: string): ts.ScriptKind => {
  switch (path.extname(filePath).toLowerCase()) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
};

const isReExportOnlyBarrel = (record: SourceRecord): boolean => {
  if (!/(^|\/)index\.[cm]?[jt]sx?$/.test(record.path)) {
    return false;
  }
  const sourceFile = ts.createSourceFile(
    record.path,
    record.content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(record.path)
  );
  return (
    sourceFile.statements.length > 0 &&
    sourceFile.statements.every(
      (statement) => ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined
    )
  );
};

const isApplicationSource = (record: SourceRecord): boolean =>
  /^(?:client\/src|server\/src|etl|scripts)\//.test(record.path) &&
  record.path !== 'scripts/audit/test-gap-audit.ts' &&
  !isTestFile(record.path) &&
  !record.path.endsWith('.d.ts') &&
  !isReExportOnlyBarrel(record);

const isTestImporter = (record: SourceRecord): boolean =>
  record.path.startsWith('tests/') && isTestFile(record.path);

const relativePath = (repoRoot: string, filePath: string): string => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
};

const finding = (
  category: string,
  pathName: string,
  evidence: string,
  recommendation: string,
  confidence: AuditFinding['confidence'] = 'medium'
): AuditFinding => ({
  id: `${category}:${pathName}:${evidence}`,
  category,
  severity: 'low',
  confidence,
  path: pathName,
  evidence,
  recommendation,
  requiredTests: [],
});

const sourceTestImporters = (inventory: RepositoryInventory): Map<string, SourceRecord[]> => {
  const importers = new Map<string, SourceRecord[]>();
  for (const testRecord of inventory.sourceRecords.filter(isTestImporter)) {
    for (const reference of testRecord.imports) {
      if (!reference.resolvedPath) {
        continue;
      }
      const current = importers.get(reference.resolvedPath) || [];
      current.push(testRecord);
      importers.set(reference.resolvedPath, current);
    }
  }
  return importers;
};

const isCoverageMetric = (value: unknown): value is CoverageMetric =>
  typeof value === 'object' &&
  value !== null &&
  'covered' in value &&
  'total' in value &&
  'pct' in value &&
  typeof value.covered === 'number' &&
  typeof value.total === 'number' &&
  typeof value.pct === 'number' &&
  Number.isFinite(value.covered) &&
  Number.isFinite(value.total) &&
  Number.isFinite(value.pct) &&
  value.total >= 0 &&
  value.covered >= 0 &&
  value.covered <= value.total &&
  value.pct >= 0 &&
  value.pct <= 100;

const coverageSummaryByPath = (
  repoRoot: string,
  coverageSummary: CoverageSummary | null
): Map<string, CoverageSummaryFile> => {
  const files = new Map<string, CoverageSummaryFile>();
  if (!coverageSummary) {
    return files;
  }
  for (const [filePath, value] of Object.entries(coverageSummary)) {
    if (filePath === 'total' || typeof value !== 'object' || value === null) {
      continue;
    }
    const metrics = value as CoverageSummaryFile;
    if (isCoverageMetric(metrics.branches) || isCoverageMetric(metrics.functions)) {
      files.set(relativePath(repoRoot, filePath), metrics);
    }
  }
  return files;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getUntestedModules = (
  inventory: RepositoryInventory,
  importers: Map<string, SourceRecord[]>
): AuditFinding[] =>
  inventory.sourceRecords
    .filter((record) => isApplicationSource(record) && record.metrics.functionCount > 0)
    .filter((record) => !(importers.get(record.path) || []).length)
    .map((record) =>
      finding(
        'untested-module-candidate',
        record.path,
        'No direct static import from a test file was found.',
        'Check indirect imports, runtime registration, and test coverage before concluding this module is untested.',
        'low'
      )
    );

const getCoverageFindings = (
  inventory: RepositoryInventory,
  coverageSummary: CoverageSummary | null
): { uncoveredBranches: AuditFinding[]; uncoveredFunctions: AuditFinding[] } => {
  const summaryByPath = coverageSummaryByPath(inventory.repoRoot, coverageSummary);
  const uncoveredBranches: AuditFinding[] = [];
  const uncoveredFunctions: AuditFinding[] = [];

  for (const record of inventory.sourceRecords.filter((candidate) =>
    isApplicationSource(candidate)
  )) {
    const coverage = summaryByPath.get(record.path);
    if (coverage && isCoverageMetric(coverage.branches)) {
      const { covered, total, pct } = coverage.branches;
      if (covered < total) {
        uncoveredBranches.push(
          finding(
            'uncovered-branches',
            record.path,
            `${covered} of ${total} branches are covered (${pct.toFixed(2)}%).`,
            'Review uncovered branch paths and add focused tests where behavior requires protection.'
          )
        );
      }
    }
    if (coverage && isCoverageMetric(coverage.functions)) {
      const { covered, total, pct } = coverage.functions;
      if (covered < total) {
        uncoveredFunctions.push(
          finding(
            'uncovered-functions',
            record.path,
            `${covered} of ${total} functions are covered (${pct.toFixed(2)}%).`,
            'Inspect the Jest coverage detail for uncalled functions and test meaningful behavior.'
          )
        );
      }
    }
  }
  return { uncoveredBranches, uncoveredFunctions };
};

const reconcileUncoveredFunctionDetails = (
  repoRoot: string,
  summaryByPath: Map<string, CoverageSummaryFile>,
  coverageFinal: CoverageFinal | null
): {
  details: Map<string, string[]>;
  status: CoverageFunctionDetailsStatus;
  matchedFiles: number;
  incompleteFiles: number;
  mismatchedFiles: number;
} => {
  const details = new Map<string, string[]>();
  if (!coverageFinal) {
    return {
      details,
      status: 'missing',
      matchedFiles: 0,
      incompleteFiles: 0,
      mismatchedFiles: 0,
    };
  }
  const functionSummary = new Map(
    [...summaryByPath.entries()].filter(([, metrics]) => isCoverageMetric(metrics.functions))
  );
  if (functionSummary.size === 0) {
    return {
      details,
      status: 'not-applicable',
      matchedFiles: 0,
      incompleteFiles: 0,
      mismatchedFiles: 0,
    };
  }
  const finalByPath = new Map<string, CoverageFinalFile>();
  for (const [coverageKey, record] of Object.entries(coverageFinal)) {
    if (!isRecord(record)) {
      continue;
    }
    const filePath = relativePath(
      repoRoot,
      typeof record.path === 'string' ? record.path : coverageKey
    );
    finalByPath.set(filePath, record as CoverageFinalFile);
  }

  let matchedFiles = 0;
  let incompleteFiles = 0;
  let mismatchedFiles = 0;
  for (const [filePath, metrics] of functionSummary) {
    const functionMetric = metrics.functions;
    const record = finalByPath.get(filePath);
    if (
      !isCoverageMetric(functionMetric) ||
      !record ||
      !isRecord(record.f) ||
      !isRecord(record.fnMap)
    ) {
      incompleteFiles += 1;
      continue;
    }

    const functionCounts = Object.entries(record.f);
    const functionMap = record.fnMap;
    const numericFunctionCounts = functionCounts.filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0
    );
    const functionIds = numericFunctionCounts.map(([id]) => id);
    if (
      numericFunctionCounts.length !== functionCounts.length ||
      functionIds.length !== functionMetric.total ||
      Object.keys(functionMap).length !== functionIds.length ||
      functionIds.some((id) => !isRecord(functionMap[id]))
    ) {
      incompleteFiles += 1;
      continue;
    }

    const coveredFunctions = numericFunctionCounts.filter(([, count]) => count > 0).length;
    if (
      coveredFunctions !== functionMetric.covered ||
      numericFunctionCounts.length !== functionMetric.total
    ) {
      mismatchedFiles += 1;
      continue;
    }

    matchedFiles += 1;
    const uncovered = numericFunctionCounts
      .filter(([, count]) => count === 0)
      .map(([id]) => {
        const fn = functionMap[id] as CoverageFunction;
        return `${fn.name || '(anonymous)'}${fn.line ? ` (line ${fn.line})` : ''}`;
      });
    if (uncovered.length > 0) {
      details.set(filePath, uncovered);
    }
  }

  return {
    details,
    status:
      mismatchedFiles > 0 ? 'inconsistent' : incompleteFiles > 0 ? 'incomplete' : 'reconciled',
    matchedFiles,
    incompleteFiles,
    mismatchedFiles,
  };
};

const getMetricMatchedFileCount = (
  inventory: RepositoryInventory,
  summaryByPath: Map<string, CoverageSummaryFile>,
  metric: 'branches' | 'functions'
): number =>
  inventory.sourceRecords.filter((record) => {
    const value = summaryByPath.get(record.path)?.[metric];
    return isApplicationSource(record) && isCoverageMetric(value);
  }).length;

const getCoverageArtifactTimeDelta = (
  summaryModifiedAt: string | null,
  finalModifiedAt: string | null
): number | null => {
  if (!summaryModifiedAt || !finalModifiedAt) {
    return null;
  }
  return Math.abs(Date.parse(summaryModifiedAt) - Date.parse(finalModifiedAt));
};

const getTestCallPath = (expression: ts.Expression): string[] => {
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return [...getTestCallPath(expression.expression), expression.name.text];
  }
  if (ts.isCallExpression(expression)) {
    return getTestCallPath(expression.expression);
  }
  return [];
};

const callRoot = (expression: ts.Expression): string | null =>
  getTestCallPath(expression)[0] || null;

const isAssertionCall = (expression: ts.Expression): boolean => {
  const segments = getTestCallPath(expression);
  const [root] = segments;
  return (
    root === 'assert' || (root === 'expect' && segments.some((segment) => /^to[A-Z]/.test(segment)))
  );
};

const getTestDiagnostics = (
  record: SourceRecord
): {
  disabled: Array<{ line: number; marker: string }>;
  testCount: number;
  testsWithoutAssertions: number;
} => {
  const sourceFile = ts.createSourceFile(
    record.path,
    record.content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(record.path)
  );
  const disabled: Array<{ line: number; marker: string }> = [];
  let testCount = 0;
  let testsWithoutAssertions = 0;
  const disabledRoots = new Set(['xit', 'xtest', 'xdescribe']);
  const testRoots = new Set(['it', 'test']);
  const skipMarkers = new Set(['skip', 'skipIf', 'todo']);

  const callbackContainsAssertion = (callback: ts.Node): boolean => {
    let found = false;
    const visitCallback = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && isAssertionCall(node.expression)) {
        found = true;
        return;
      }
      if (!found) {
        ts.forEachChild(node, visitCallback);
      }
    };
    visitCallback(callback);
    return found;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const root = callRoot(node.expression);
      const segments = getTestCallPath(node.expression);
      const isNestedCallTarget =
        ts.isCallExpression(node.parent) && node.parent.expression === node;
      const isDisabledTest =
        root !== null &&
        (disabledRoots.has(root) ||
          (['it', 'test', 'describe'].includes(root) &&
            segments.some((segment) => skipMarkers.has(segment))));

      if (!isNestedCallTarget && root && testRoots.has(root)) {
        const firstArgument = node.arguments[0];
        if (
          firstArgument &&
          (ts.isStringLiteralLike(firstArgument) || ts.isTemplateExpression(firstArgument))
        ) {
          testCount += 1;
          const callback = node.arguments.find(
            (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
          );
          if (callback && !isDisabledTest && !callbackContainsAssertion(callback)) {
            testsWithoutAssertions += 1;
          }
        }
      }
      if (!isNestedCallTarget && isDisabledTest) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const skipMarker = segments.find((segment) => skipMarkers.has(segment));
        disabled.push({
          line: line + 1,
          marker: root && disabledRoots.has(root) ? root : skipMarker || 'skip',
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { disabled, testCount, testsWithoutAssertions };
};

const getSkippedTests = (testRecords: SourceRecord[]): AuditFinding[] =>
  testRecords.flatMap((record) =>
    getTestDiagnostics(record).disabled.map(({ line, marker }) =>
      finding(
        'disabled-test',
        record.path,
        `Detected \`${marker}\` test marker at line ${line}.`,
        'Confirm the skipped or todo test has a documented reason and a clear re-enable condition.',
        'high'
      )
    )
  );

const ASSET_EXTENSIONS = [
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.txt',
  '.wasm',
  '.node',
];

const importMayExist = (fromPath: string, specifier: string, allFiles: Set<string>): boolean => {
  if (resolveRelativeImport(fromPath, specifier, allFiles)) {
    return true;
  }
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  if (base === '..' || base.startsWith('../') || base.startsWith('/')) {
    return false;
  }
  if (path.posix.extname(specifier)) {
    return allFiles.has(base);
  }
  return ASSET_EXTENSIONS.some(
    (extension) => allFiles.has(`${base}${extension}`) || allFiles.has(`${base}/index${extension}`)
  );
};

const getBrokenImports = (
  testRecords: SourceRecord[],
  inventory: RepositoryInventory
): AuditFinding[] => {
  const allFiles = new Set(inventory.allFiles);
  return testRecords.flatMap((record) =>
    record.imports
      .filter(
        (reference) =>
          reference.specifier.startsWith('.') &&
          !reference.resolvedPath &&
          !importMayExist(record.path, reference.specifier, allFiles)
      )
      .map((reference) =>
        finding(
          'unresolved-test-import',
          record.path,
          `Relative import \`${reference.specifier}\` does not resolve to an inventoried file.`,
          'Verify the import path and test runner aliases; static resolution does not cover every custom loader.',
          'high'
        )
      )
  );
};

const getIntegrationCandidates = (
  inventory: RepositoryInventory,
  importers: Map<string, SourceRecord[]>
): AuditFinding[] =>
  inventory.sourceRecords
    .filter(
      (record) =>
        /^server\/src\/api\/routes\//.test(record.path) &&
        (importers.get(record.path) || []).some((test) => test.path.startsWith('tests/unit/')) &&
        !(importers.get(record.path) || []).some((test) =>
          test.path.startsWith('tests/integration/')
        )
    )
    .map((record) => {
      const unitImportCount = (importers.get(record.path) || []).filter((test) =>
        test.path.startsWith('tests/unit/')
      ).length;
      return finding(
        'integration-test-candidate',
        record.path,
        `${unitImportCount} unit test file(s) directly import this route; no integration test directly imports it.`,
        'Review app-level integration tests to confirm the route is exercised; indirect registration and imports are not inferred.',
        'low'
      );
    });

const getQualityCandidates = (testRecords: SourceRecord[]): AuditFinding[] =>
  testRecords.flatMap((record) => {
    const { testCount, testsWithoutAssertions } = getTestDiagnostics(record);
    if (testCount === 0 || testsWithoutAssertions === 0) {
      return [];
    }
    return [
      finding(
        'test-quality-review',
        record.path,
        `${testsWithoutAssertions} of ${testCount} test declaration(s) have no statically recognizable matcher or assertion call.`,
        'Manually review whether the tests verify observable behavior; custom assertion helpers may not be detected.',
        'low'
      ),
    ];
  });

export const analyzeTestGaps = (
  inventory: RepositoryInventory,
  coverageSummary: CoverageSummary | null = null,
  coverageFinal: CoverageFinal | null = null,
  artifactMetadata: CoverageArtifactMetadata = {
    summaryModifiedAt: null,
    finalModifiedAt: null,
  }
): TestGapAuditResult => {
  const testRecords = inventory.sourceRecords.filter(isTestImporter);
  const importers = sourceTestImporters(inventory);
  const coverageFindings = getCoverageFindings(inventory, coverageSummary);
  const summaryByPath = coverageSummaryByPath(inventory.repoRoot, coverageSummary);
  const functionDetails = reconcileUncoveredFunctionDetails(
    inventory.repoRoot,
    summaryByPath,
    coverageFinal
  );
  const uncoveredFunctions = coverageFindings.uncoveredFunctions.map((item) => {
    const functions = functionDetails.details.get(item.path);
    return functions
      ? {
          ...item,
          evidence: `${item.evidence} Uncovered: ${functions.slice(0, 5).join(', ')}${functions.length > 5 ? `, and ${functions.length - 5} more` : ''}.`,
        }
      : item;
  });
  const applicationFiles = inventory.sourceRecords.filter(isApplicationSource);
  const coverageSummaryMatchedFiles = inventory.sourceRecords.filter(
    (record) =>
      isApplicationSource(record) &&
      (isCoverageMetric(summaryByPath.get(record.path)?.branches) ||
        isCoverageMetric(summaryByPath.get(record.path)?.functions))
  ).length;
  const coverageBranchMatchedFiles = getMetricMatchedFileCount(
    inventory,
    summaryByPath,
    'branches'
  );
  const coverageFunctionMatchedFiles = getMetricMatchedFileCount(
    inventory,
    summaryByPath,
    'functions'
  );

  return {
    untestedModules: getUntestedModules(inventory, importers),
    uncoveredBranches: coverageFindings.uncoveredBranches,
    uncoveredFunctions,
    skippedTests: getSkippedTests(testRecords),
    brokenImports: getBrokenImports(testRecords, inventory),
    integrationCandidates: getIntegrationCandidates(inventory, importers),
    qualityCandidates: getQualityCandidates(testRecords),
    coverageSummaryStatus:
      coverageSummary === null
        ? 'missing'
        : coverageSummaryMatchedFiles > 0
          ? 'usable'
          : 'present-unusable',
    coverageSummaryModifiedAt: artifactMetadata.summaryModifiedAt,
    coverageSummaryMatchedFiles,
    coverageBranchMatchedFiles,
    coverageFunctionMatchedFiles,
    coverageEligibleFiles: applicationFiles.length,
    coverageFinalPresent: coverageFinal !== null,
    coverageFinalModifiedAt: artifactMetadata.finalModifiedAt,
    coverageArtifactTimeDeltaMs: getCoverageArtifactTimeDelta(
      artifactMetadata.summaryModifiedAt,
      artifactMetadata.finalModifiedAt
    ),
    coverageFunctionDetailsStatus: functionDetails.status,
    coverageFunctionDetailsMatchedFiles: functionDetails.matchedFiles,
    coverageFunctionDetailsIncompleteFiles: functionDetails.incompleteFiles,
    coverageFunctionDetailsMismatchedFiles: functionDetails.mismatchedFiles,
  };
};

export type { CoverageFinal, CoverageSummary };
