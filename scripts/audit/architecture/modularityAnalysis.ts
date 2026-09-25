import fs from 'node:fs';
import path from 'node:path';
import type {
  ArchitectureAuditConfig,
  AuditFinding,
  ModularityAuditResult,
  RepositoryInventory,
  RoleThreshold,
  SourceRecord,
} from './types';
import { globToRegex } from './inventory';

type PolicyRules = {
  maxLines?: number;
  maxImports?: number;
  maxExports?: number;
  maxFunctions?: number;
  maxFunctionLines?: number;
};

type PolicyConfig = {
  files?: Record<string, PolicyRules>;
  globs?: Array<{ pattern: string; rules: PolicyRules }>;
};

type LineCountPolicyConfig = {
  files?: Record<string, number>;
  globs?: Array<{ pattern: string; threshold: number }>;
};

export const classifyRole = (file: string): string => {
  const name = path.basename(file);
  if (/^(tests\/|client\/src\/.*__tests__\/)|\.(test|spec)\.[jt]sx?$/.test(file)) {
    return 'test';
  }
  if (file === 'client/src/config/apiTestEndpoints.ts') {
    return 'registry';
  }
  if (file.startsWith('etl/')) {
    return 'etl';
  }
  if (file.startsWith('scripts/')) {
    return 'script';
  }
  if (/\/api\/routes\//.test(file) || /Routes?\.[jt]s$/.test(name)) {
    return 'route';
  }
  if (/repositories?\//i.test(file) || /Repository\.[jt]s$/i.test(name)) {
    return 'repository';
  }
  if (/\/hooks\//.test(file) || /^use[A-Z].*\.[jt]sx?$/.test(name)) {
    return 'hook';
  }
  if (/\/components\//.test(file) && /\.[jt]sx$/.test(file)) {
    return 'component';
  }
  if (/\/stores?\//.test(file) || /Store\.[jt]s$/i.test(name)) {
    return 'store';
  }
  if (/\/services?\//.test(file) || /Service\.[jt]s$/i.test(name)) {
    return 'service';
  }
  return 'other';
};

const relatedTests = (inventory: RepositoryInventory, sourcePath: string): string[] => {
  const basename = path
    .basename(sourcePath)
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  const matches = inventory.sourceRecords
    .filter(
      (record) => record.path.startsWith('tests/') && record.path.toLowerCase().includes(basename)
    )
    .slice(0, 4)
    .map((record) => `npx jest ${record.path} --no-coverage --runInBand`);
  return matches.length > 0
    ? matches
    : ['Add or identify focused characterization tests before refactoring.', 'npm run type-check'];
};

const severityForRatio = (current: number, threshold: number): 'high' | 'medium' =>
  current / threshold >= 1.5 ? 'high' : 'medium';

const REPOSITORY_SUPPORT_PATH = /\/(?:filterQueryBuilder|repositories|mappers)\//i;
const REPOSITORY_SUPPORT_MODULE =
  /(?:\.types|\/(?:types|config|settings|params|sql(?:Expressions)?|serialization)|adminQueryAdapter|(?:Gateway|Queries|Utils))\.[jt]sx?$/i;

export const isRepositoryOrchestrationImport = (resolvedPath: string | null): boolean =>
  Boolean(
    resolvedPath?.includes('/services/') &&
    !resolvedPath.endsWith('/services/adminDbService.ts') &&
    !REPOSITORY_SUPPORT_PATH.test(resolvedPath) &&
    !REPOSITORY_SUPPORT_MODULE.test(resolvedPath)
  );

const buildOversizedFindings = (
  inventory: RepositoryInventory,
  config: ArchitectureAuditConfig
): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  for (const record of inventory.sourceRecords) {
    const role = classifyRole(record.path);
    const threshold = config.roles[role] ?? config.roles.other;
    const checks: Array<[keyof RoleThreshold, number, string]> = [
      ['maxLines', record.metrics.lineCount, 'lines'],
      ['maxImports', record.metrics.importCount, 'imports'],
      ['maxFunctions', record.metrics.functionCount, 'functions'],
      ['maxFunctionLines', record.metrics.maxFunctionLines, 'largest function lines'],
    ];
    const breaches: Array<{
      key: keyof RoleThreshold;
      current: number;
      label: string;
      limit: number;
    }> = [];
    for (const [key, current, label] of checks) {
      const limit = threshold[key];
      if (current > limit) {
        breaches.push({ key, current, label, limit });
      }
    }
    if (breaches.length === 0) {
      continue;
    }
    const isHigh = breaches.some(
      (breach) => severityForRatio(breach.current, breach.limit) === 'high'
    );
    findings.push({
      id: `threshold:${record.path}`,
      category: 'structural-threshold',
      severity: role === 'test' ? 'info' : isHigh ? 'high' : 'medium',
      confidence: 'high',
      path: record.path,
      evidence: `${role} module exceeds: ${breaches
        .map((breach) => `${breach.current} ${breach.label} > ${breach.limit}`)
        .join('; ')}.`,
      recommendation:
        role === 'test'
          ? 'Confirm the size is justified by fixture breadth before splitting.'
          : 'Review responsibility boundaries and extract cohesive units without changing behavior.',
      requiredTests: relatedTests(inventory, record.path),
    });
  }
  return findings;
};

const buildRoleViolationFindings = (inventory: RepositoryInventory): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  for (const record of inventory.sourceRecords) {
    const role = classifyRole(record.path);
    if (
      role === 'route' &&
      record.metrics.sqlStatementCount >= 1 &&
      /\b(query|adminQuery)\s*\(/.test(record.content)
    ) {
      findings.push({
        id: `role:route-sql:${record.path}`,
        category: 'role-violation',
        severity: 'high',
        confidence: 'high',
        path: record.path,
        evidence: `Route module contains ${record.metrics.sqlStatementCount} SQL keyword occurrences.`,
        recommendation:
          'Move SQL into a repository and keep the route limited to validation and response mapping.',
        requiredTests: relatedTests(inventory, record.path),
      });
    }

    if (
      role === 'service' &&
      record.metrics.sqlStatementCount >= 4 &&
      /\b(query|adminQuery)\s*\(/.test(record.content) &&
      !/Repository\.[jt]s$/i.test(record.path)
    ) {
      findings.push({
        id: `role:service-sql:${record.path}`,
        category: 'role-review',
        severity: 'medium',
        confidence: 'medium',
        path: record.path,
        evidence: `Service contains ${record.metrics.sqlStatementCount} SQL keyword occurrences and direct query calls.`,
        recommendation:
          'Verify whether SQL ownership belongs in a dedicated repository under the route-service-repository contract.',
        requiredTests: relatedTests(inventory, record.path),
      });
    }

    if (role === 'repository') {
      const serviceImports = record.imports.filter((reference) =>
        isRepositoryOrchestrationImport(reference.resolvedPath)
      );
      if (serviceImports.length > 0) {
        findings.push({
          id: `role:repository-service:${record.path}`,
          category: 'role-violation',
          severity: 'medium',
          confidence: 'high',
          path: record.path,
          evidence: `Repository imports service-layer modules: ${serviceImports.map((item) => item.resolvedPath).join(', ')}.`,
          recommendation: 'Invert the dependency or move orchestration out of the repository.',
          requiredTests: relatedTests(inventory, record.path),
        });
      }
    }

    if (
      role === 'hook' &&
      /(adjacency|connected component|graph traversal|addUndirectedEdge|breadth.first|depth.first)/i.test(
        record.content
      )
    ) {
      findings.push({
        id: `role:hook-algorithm:${record.path}`,
        category: 'role-review',
        severity: 'medium',
        confidence: 'medium',
        path: record.path,
        evidence:
          'React hook contains graph/adjacency algorithm signals alongside hydration or effect coordination.',
        recommendation:
          'Extract pure graph logic into a directly tested utility while leaving effect orchestration in the hook.',
        requiredTests: relatedTests(inventory, record.path),
      });
    }
  }
  return findings;
};

const buildCouplingFindings = (inventory: RepositoryInventory): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  for (const record of inventory.sourceRecords) {
    const fanOut = new Set(
      record.imports.map((reference) => reference.resolvedPath).filter(Boolean)
    ).size;
    const fanIn = (inventory.inboundReferences.get(record.path) || []).length;
    if (fanOut >= 20) {
      findings.push({
        id: `coupling:fan-out:${record.path}`,
        category: 'high-fan-out',
        severity: fanOut >= 30 ? 'high' : 'medium',
        confidence: 'high',
        path: record.path,
        evidence: `Static fan-out is ${fanOut} internal modules.`,
        recommendation:
          'Review whether this coordinator mixes unrelated domains or should delegate to smaller facades.',
        requiredTests: relatedTests(inventory, record.path),
      });
    }
    if (fanIn >= 25 && record.metrics.exportCount >= 10) {
      findings.push({
        id: `coupling:hub:${record.path}`,
        category: 'coupling-hub',
        severity: 'medium',
        confidence: 'high',
        path: record.path,
        evidence: `Static fan-in is ${fanIn} modules with ${record.metrics.exportCount} exports.`,
        recommendation:
          'Treat this as a high-blast-radius API; add characterization tests before changing its contract.',
        requiredTests: relatedTests(inventory, record.path),
      });
    }
  }
  return findings;
};

const getMetric = (record: SourceRecord, key: keyof PolicyRules): number => {
  if (key === 'maxLines') {
    return record.content.split(/\r?\n/).length;
  }
  const mapping: Record<keyof PolicyRules, keyof SourceRecord['metrics']> = {
    maxLines: 'lineCount',
    maxImports: 'importCount',
    maxExports: 'exportCount',
    maxFunctions: 'functionCount',
    maxFunctionLines: 'maxFunctionLines',
  };
  return record.metrics[mapping[key]];
};

const evaluatePolicyRules = (
  inventory: RepositoryInventory,
  file: string,
  rules: PolicyRules
): AuditFinding[] => {
  const record = inventory.sourceByPath.get(file);
  if (!record) {
    return [
      {
        id: `policy:missing:${file}`,
        category: 'policy-config',
        severity: 'high',
        confidence: 'high',
        path: file,
        evidence: 'Configured modularity policy path does not exist in the audited inventory.',
        recommendation: 'Correct the policy path or restore the protected module.',
        requiredTests: ['npm run policy:modularity'],
      },
    ];
  }
  const findings: AuditFinding[] = [];
  for (const [key, limit] of Object.entries(rules) as Array<[keyof PolicyRules, number]>) {
    const current = getMetric(record, key);
    if (current <= limit) {
      continue;
    }
    findings.push({
      id: `policy:${file}:${key}`,
      category: 'policy-threshold',
      severity: 'high',
      confidence: 'high',
      path: file,
      evidence: `${key} is ${current}; configured threshold is ${limit}.`,
      recommendation:
        'Resolve the regression without raising the threshold unless the architecture contract changed.',
      requiredTests: ['npm run policy:modularity'],
    });
  }
  return findings;
};

const evaluateLineCountPolicy = (
  inventory: RepositoryInventory,
  file: string,
  limit: number
): AuditFinding[] => {
  const record = inventory.sourceByPath.get(file);
  if (!record) {
    return [
      {
        id: `policy:line-count:missing:${file}`,
        category: 'policy-config',
        severity: 'high',
        confidence: 'high',
        path: file,
        evidence: 'Configured documentation line-count policy path does not exist.',
        recommendation: 'Correct the policy path or restore the protected module.',
        requiredTests: ['npm run policy:modularity'],
      },
    ];
  }
  if (record.metrics.lineCount <= limit) {
    return [];
  }
  return [
    {
      id: `policy:line-count:${file}`,
      category: 'policy-threshold',
      severity: 'high',
      confidence: 'high',
      path: file,
      evidence: `lineCount is ${record.metrics.lineCount}; documented threshold is ${limit}.`,
      recommendation:
        'Resolve the regression without raising the threshold unless the architecture contract changed.',
      requiredTests: ['npm run policy:modularity'],
    },
  ];
};

const buildLineCountPolicyFindings = (inventory: RepositoryInventory): AuditFinding[] => {
  const policyPath = path.join(inventory.repoRoot, 'scripts/doc-line-count-thresholds.json');
  if (!fs.existsSync(policyPath)) {
    return [];
  }
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as LineCountPolicyConfig;
  const findings: AuditFinding[] = [];
  const checked = new Set<string>();
  for (const [file, limit] of Object.entries(policy.files || {})) {
    checked.add(file);
    findings.push(...evaluateLineCountPolicy(inventory, file, limit));
  }
  for (const entry of policy.globs || []) {
    const matches = inventory.sourceRecords.filter((record) =>
      globToRegex(entry.pattern).test(record.path)
    );
    if (matches.length === 0) {
      findings.push({
        id: `policy:line-count:glob:${entry.pattern}`,
        category: 'policy-config',
        severity: 'high',
        confidence: 'high',
        path: 'scripts/doc-line-count-thresholds.json',
        evidence: `Configured glob \`${entry.pattern}\` matched no files.`,
        recommendation: 'Update the stale path or restore the expected module family.',
        requiredTests: ['npm run policy:modularity'],
      });
    }
    for (const record of matches) {
      if (checked.has(record.path)) {
        continue;
      }
      checked.add(record.path);
      findings.push(...evaluateLineCountPolicy(inventory, record.path, entry.threshold));
    }
  }
  return findings;
};

const buildPolicyFindings = (inventory: RepositoryInventory): AuditFinding[] => {
  const policyPath = path.join(inventory.repoRoot, 'scripts/modularity-rules.json');
  if (!fs.existsSync(policyPath)) {
    return [];
  }
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as PolicyConfig;
  const findings: AuditFinding[] = buildLineCountPolicyFindings(inventory);
  for (const [file, rules] of Object.entries(policy.files || {})) {
    findings.push(...evaluatePolicyRules(inventory, file, rules));
  }
  for (const entry of policy.globs || []) {
    const matches = inventory.sourceRecords.filter((record) =>
      globToRegex(entry.pattern).test(record.path)
    );
    if (matches.length === 0) {
      findings.push({
        id: `policy:glob:${entry.pattern}`,
        category: 'policy-config',
        severity: 'high',
        confidence: 'high',
        path: 'scripts/modularity-rules.json',
        evidence: `Configured glob \`${entry.pattern}\` matched no files.`,
        recommendation: 'Update the stale path or restore the expected module family.',
        requiredTests: ['npm run policy:modularity'],
      });
    }
    for (const record of matches) {
      findings.push(...evaluatePolicyRules(inventory, record.path, entry.rules));
    }
  }
  return findings;
};

export const analyzeModularity = (
  inventory: RepositoryInventory,
  config: ArchitectureAuditConfig
): ModularityAuditResult => {
  const oversizedModules = buildOversizedFindings(inventory, config);
  const roleViolations = buildRoleViolationFindings(inventory);
  const couplingCandidates = buildCouplingFindings(inventory);
  const policyFindings = buildPolicyFindings(inventory);
  const findings = [
    ...policyFindings,
    ...roleViolations,
    ...couplingCandidates,
    ...oversizedModules,
  ];
  const largestModules = [...inventory.sourceRecords]
    .sort((a, b) => b.metrics.lineCount - a.metrics.lineCount)
    .slice(0, 30);
  return {
    findings,
    oversizedModules,
    roleViolations,
    couplingCandidates,
    policyFindings,
    largestModules,
  };
};
